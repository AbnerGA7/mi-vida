import { askAi, parseJsonLoose } from '@/lib/ai';
import { CATEGORIAS, CUENTAS, type NewTransaction } from '@/lib/finance/repository';
import { CUENTA_ALIAS, findMonto, parseSimple, sinTildes, today } from '@/lib/finance/simple-capture';

export { parseSimple, today };

const SYSTEM = `Convierte el texto de un gasto o ingreso en soles peruanos a JSON.
Responde SOLO con JSON: {"monto": number, "tipo": "gasto"|"ingreso", "categoria": string, "cuenta": string, "descripcion": string}
categoria debe ser una de: ${CATEGORIAS.join(', ')}.
cuenta debe ser una de: ${CUENTAS.join(', ')} (si no se dice, "efectivo").
descripcion: 2 a 5 palabras.`;

// Con este esquema la IA local no puede inventar categorías ni dejar el JSON a medias.
const SCHEMA = {
  type: 'object',
  properties: {
    monto: { type: 'number' },
    tipo: { type: 'string', enum: ['gasto', 'ingreso'] },
    categoria: { type: 'string', enum: [...CATEGORIAS] },
    cuenta: { type: 'string', enum: [...CUENTAS] },
    descripcion: { type: 'string' },
  },
  required: ['monto', 'tipo', 'categoria', 'cuenta', 'descripcion'],
};

export async function parseWithAi(texto: string): Promise<NewTransaction> {
  const { text } = await askAi(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: texto },
    ],
    { privado: true, maxTokens: 100, rapido: true, json: true, jsonSchema: SCHEMA },
  );
  const json = parseJsonLoose(text);
  // El monto lo saco del texto si lo hay: la IA a veces se equivoca con los números.
  const monto = findMonto(sinTildes(texto)) ?? Number(json.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('No encontré el monto. Ej: "25 menú con yape".');

  return {
    fecha: today(),
    monto,
    tipo: json.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    descripcion: String(json.descripcion || texto).trim(),
    categoria: (CATEGORIAS as readonly string[]).includes(json.categoria) ? json.categoria : 'otros',
    cuenta: (CUENTAS as readonly string[]).includes(json.cuenta) ? json.cuenta : 'efectivo',
  };
}

export type CaptureResult = NewTransaction & { conIa: boolean };

// Lo común se resuelve al toque en código; solo lo raro va a la IA.
// Si no hay IA disponible pero sí hay monto, lo guardo en "otros" para no perder el registro.
export async function quickCapture(texto: string): Promise<CaptureResult> {
  const simple = parseSimple(texto);
  if (simple) return { ...simple, conIa: false };
  const monto = findMonto(sinTildes(texto));
  if (!monto) throw new Error('No encontré el monto. Ej: "25 menú con yape" o "me pagaron 1200".');
  try {
    return { ...(await parseWithAi(texto)), conIa: true };
  } catch {
    const words = sinTildes(texto).split(/[^a-z0-9]+/);
    const cuenta = words.map((w) => CUENTA_ALIAS[w]).find(Boolean) ?? 'efectivo';
    return { fecha: today(), monto, tipo: 'gasto', descripcion: texto.trim(), categoria: 'otros', cuenta, conIa: false };
  }
}
