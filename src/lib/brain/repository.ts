import * as FileSystem from 'expo-file-system/legacy';

import { askAi, type AiSource } from '@/lib/ai';
import { pasajes, toFtsQuery } from '@/lib/brain/answer';
import type { ExtractedDocument } from '@/lib/brain/extract';
import { getDb } from '@/lib/db';

export type Documento = ExtractedDocument & { id: number; created_at: string };

export async function saveDocument(doc: ExtractedDocument) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO documents (nombre, categoria, ruta, texto, resumen, fecha_vencimiento) VALUES (?, ?, ?, ?, ?, ?)',
    doc.nombre,
    doc.categoria,
    doc.ruta,
    doc.texto,
    doc.resumen,
    doc.fecha_vencimiento,
  );
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


export async function searchDocuments(pregunta: string, limit = 5) {
  const query = toFtsQuery(pregunta);
  if (!query) return [];
  const db = await getDb();
  return db.getAllAsync<Documento>(
    `SELECT d.* FROM documents_fts f JOIN documents d ON d.id = f.rowid
     WHERE documents_fts MATCH ? ORDER BY bm25(documents_fts, 10.0, 1.0) LIMIT ?`,
    query,
    limit,
  );
}

const SYSTEM = `Respondes preguntas sobre MIS documentos personales usando SOLO los fragmentos dados.
- Primera línea: el dato exacto.
- Después: "Fuente: [n] nombre del documento".
- Si el dato no está en los fragmentos, di "No lo encuentro en tus documentos" y sugiere qué documento subir.
- Nunca muestres números completos de DNI, cuentas o tarjetas: solo los últimos 4 dígitos.
- No des interpretaciones legales.`;

export type Answer = { texto: string; fuentes: Documento[]; source: AiSource | null };

export async function askDocuments(pregunta: string): Promise<Answer> {
  const fuentes = await searchDocuments(pregunta);
  if (fuentes.length === 0) {
    return { texto: 'No lo encuentro en tus documentos. Sube o escanea el documento relacionado.', fuentes, source: null };
  }
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
        `[${i + 1}] ${d.nombre} (${d.categoria}${d.fecha_vencimiento ? `, vence ${d.fecha_vencimiento}` : ''})\n${pasajes(d.texto ?? '', pregunta)}`,
    )
    .join('\n\n');

  const { text, source } = await askAi(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Fragmentos:\n${contexto}\n\nPregunta: ${pregunta}` },
    ],
    { privado: true, maxTokens: 300 },
  );
  return { texto: text, fuentes, source };
}
