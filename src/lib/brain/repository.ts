import * as FileSystem from 'expo-file-system/legacy';

import { askAi, type AiOptions, type AiSource } from '@/lib/ai';
import type { ExtractedDocument } from '@/lib/brain/extract';
import { getDb } from '@/lib/db';

export type Documento = ExtractedDocument & { id: number; created_at: string };

export async function saveDocument(doc: ExtractedDocument) {
  const db = await getDb();
  const r = await db.runAsync(
    'INSERT INTO documents (nombre, categoria, ruta, texto, resumen, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)',
    doc.nombre,
    doc.categoria,
    doc.ruta,
    doc.texto,
    doc.resumen,
    doc.fecha_vencimiento,
  );
  return r.lastInsertRowId;
}

// La IA mejoró la categoría y el resumen en segundo plano.
export async function updateDocumentMeta(id: number, categoria: string, resumen: string) {
  const db = await getDb();
  await db.runAsync('UPDATE documents SET categoria = ?, resumen = ? WHERE id = ?', categoria, resumen, id);
}

// Guardo lo que salió de volver a leer un documento (el trigger actualiza la búsqueda FTS).
export async function updateDocumentContent(id: number, doc: ExtractedDocument) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE documents SET categoria = ?, texto = ?, resumen = ?, fecha_vencimiento = ? WHERE id = ?',
    doc.categoria,
    doc.texto,
    doc.resumen,
    doc.fecha_vencimiento,
    id,
  );
}

export async function updateExpiration(id: number, fecha: string | null) {
  const db = await getDb();
  await db.runAsync('UPDATE documents SET fecha_vencimiento = ? WHERE id = ?', fecha, id);
}

export async function deleteDocument(doc: Documento) {
  const db = await getDb();
  await db.runAsync('DELETE FROM documents WHERE id = ?', doc.id);
  await FileSystem.deleteAsync(doc.ruta, { idempotent: true });
}

// Lo que vence pronto primero; lo que no tiene fecha, al final.
export async function listDocuments() {
  const db = await getDb();
  return db.getAllAsync<Documento>(
    `SELECT * FROM documents
     ORDER BY fecha_vencimiento IS NULL, fecha_vencimiento ASC, created_at DESC`,
  );
}

const STOP = new Set([
  'que', 'cual', 'cuales', 'cuando', 'donde', 'como', 'cuanto', 'cuanta', 'quien', 'mis', 'los', 'las', 'del',
  'una', 'uno', 'para', 'por', 'con', 'sin', 'tengo', 'tiene', 'esta', 'este', 'esa', 'ese', 'hay', 'dime', 'sabes',
  'puedes', 'mi', 'me', 'es', 'el', 'la', 'de', 'en', 'y', 'o', 'a', 'al', 'lo', 'se', 'su', 'sus', 'son',
]);

function palabrasClave(pregunta: string) {
  return (
    pregunta
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .match(/[a-z0-9]{3,}/g)
      ?.filter((p) => !STOP.has(p)) ?? []
  );
}

function toFtsQuery(pregunta: string) {
  const palabras = palabrasClave(pregunta);
  return palabras.map((p) => `"${p}"*`).join(' OR ');
}

export async function searchDocuments(pregunta: string, limit = 3) {
  const query = toFtsQuery(pregunta);
  if (!query) return [];
  const db = await getDb();
  try {
    return await db.getAllAsync<Documento>(
      `SELECT d.* FROM documents_fts f JOIN documents d ON d.id = f.rowid
       WHERE documents_fts MATCH ? ORDER BY bm25(documents_fts) LIMIT ?`,
      query,
      limit,
    );
  } catch {
    // Consulta FTS inválida (caracteres raros): busco con LIKE como respaldo.
    const p = `%${palabrasClave(pregunta)[0] ?? pregunta}%`;
    return db.getAllAsync<Documento>(
      'SELECT * FROM documents WHERE nombre LIKE ? OR texto LIKE ? OR categoria LIKE ? LIMIT ?',
      p,
      p,
      p,
      limit,
    );
  }
}

// En vez de mandar los primeros 1500 caracteres de cada documento, mando las partes
// donde aparecen las palabras de la pregunta (y las fechas de vigencia). Menos texto = respuesta
// mucho más rápida en la IA local, y más precisa porque el dato sí está en el fragmento.
export function bestSnippet(texto: string, pregunta: string, max = 900) {
  if (texto.length <= max) return texto;
  const lower = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const claves = [...palabrasClave(pregunta), 'venc', 'vigen', 'hasta'];
  const hits: number[] = [];
  for (const c of claves) {
    let i = lower.indexOf(c);
    let n = 0;
    while (i >= 0 && n < 3) {
      hits.push(i);
      i = lower.indexOf(c, i + c.length);
      n++;
    }
  }
  if (hits.length === 0) return texto.slice(0, max);
  hits.sort((a, b) => a - b);
  const ventana = 220;
  const rangos: [number, number][] = [];
  for (const h of hits) {
    const a = Math.max(0, h - ventana / 2);
    const b = Math.min(texto.length, h + ventana);
    const last = rangos.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else rangos.push([a, b]);
  }
  let out = '';
  for (const [a, b] of rangos) {
    if (out.length >= max) break;
    out += (out ? ' … ' : '') + texto.slice(a, b).replace(/\s+/g, ' ');
  }
  return out.slice(0, max);
}

const SYSTEM = `Respondes preguntas sobre MIS documentos personales usando SOLO los fragmentos dados.
- Primera línea: el dato exacto, corto y directo.
- Después: "Fuente: [n] nombre del documento".
- Si el dato no está en los fragmentos, di "No lo encuentro en tus documentos" y sugiere qué documento subir.
- Nunca muestres números completos de DNI, cuentas o tarjetas: solo los últimos 4 dígitos.
- No des interpretaciones legales.`;

export type Answer = { texto: string; fuentes: Documento[]; source: AiSource | null };

// Preguntas que respondo directo desde la base, sin IA (instantáneo).
function respuestaDirecta(pregunta: string, fuentes: Documento[]): string | null {
  const p = pregunta.toLowerCase();
  if (!/vence|vencimiento|vigencia|caduca|expira|hasta cuando/.test(p)) return null;
  // Solo si el documento más relevante tiene fecha: si no, que la IA lea el texto.
  const doc = fuentes[0];
  if (!doc?.fecha_vencimiento) return null;
  const [y, m, d] = doc.fecha_vencimiento!.split('-');
  const dias = Math.round((Date.UTC(+y, +m - 1, +d) - Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400000);
  const cuando = dias < 0 ? `venció hace ${-dias} días` : dias === 0 ? 'vence hoy' : `vence en ${dias} días`;
  return `${doc.nombre}: ${cuando} (${d}/${m}/${y}).\nFuente: [1] ${doc.nombre}`;
}

export async function askDocuments(
  pregunta: string,
  opts: Pick<AiOptions, 'onPartial' | 'signal'> = {},
): Promise<Answer> {
  const fuentes = await searchDocuments(pregunta);
  if (fuentes.length === 0) {
    return { texto: 'No lo encuentro en tus documentos. Sube o escanea el documento relacionado.', fuentes, source: null };
  }
  const directa = respuestaDirecta(pregunta, fuentes);
  if (directa) return { texto: directa, fuentes, source: null };

  if (fuentes.every((d) => !d.texto?.trim())) {
    return {
      texto: 'Encontré el documento, pero todavía no tengo su texto. Tócalo y elige "Volver a leer".',
      fuentes,
      source: null,
    };
  }
  const contexto = fuentes
    .map(
      (d, i) =>
        `[${i + 1}] ${d.nombre} (${d.categoria}${d.fecha_vencimiento ? `, vence ${d.fecha_vencimiento}` : ''})\n${bestSnippet(d.texto ?? '', pregunta)}`,
    )
    .join('\n\n');

  const { text, source } = await askAi(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Fragmentos:\n${contexto}\n\nPregunta: ${pregunta}` },
    ],
    { privado: true, maxTokens: 220, temperature: 0.2, ...opts },
  );
  return { texto: text, fuentes, source };
}
