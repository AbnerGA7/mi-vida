// Asistente central: detecto en código qué quiero hacer (registrar plata, crear tarea, preguntar
// por documentos o plata). Sin módulos nativos para poder probarlo con bun test.
import { parseSimple } from '@/lib/finance/simple-capture';

export const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ---------- Detección de intención (en código) ----------

export const RE_GASTO = /^(gaste|pague|compre|anota|anotame|registra|registrame|apunta|me cobraron)\b/;
export const RE_INGRESO = /^(me pagaron|cobre|me depositaron|me yapearon|me plinearon|recibi|gane|me devolvieron)\b/;
export const RE_TAREA = /^(recuerdame|recordarme|recordatorio|tarea|nueva tarea|agrega tarea|anota tarea|tengo que|no olvidar|no me olvide de|pendiente)\b[:,]?\s*/;
export const RE_DOCS = /\b(soat|dni|pasaporte|brevete|licencia|poliza|seguro|contrato|documento|documentos|vence|vencimiento|vigencia|tarjeta de propiedad|revision tecnica|certificado|recibo)\b/;
export const RE_PLATA = /\b(plata|dinero|gasto|gaste|gastos|gastando|ahorro|ahorrar|presupuesto|presupuestos|balance|ingreso|ingresos|sueldo|soles|deuda|deudas|yape|plin|tarjeta|cuanto llevo|finanzas|mes|economia|comida|transporte)\b/;

export function esRegistroDePlata(t: string) {
  const s = sinTildes(t.trim());
  if (!/\d/.test(s)) return false;
  // "gasté 25 en menú", "me pagaron 1200", o directamente "25 menú con yape" (si reconozco la categoría).
  if (RE_GASTO.test(s) || RE_INGRESO.test(s)) return true;
  return /^\s*(s\/\.?\s*)?\d+([.,]\d+)?\s+[a-z]/.test(s) && !s.includes('?') && parseSimple(t) !== null;
}

// "recuérdame pagar la luz el viernes!" → "pagar la luz el viernes!". null si no es una tarea.
export function textoDeTarea(texto: string): string | null {
  const t = texto.trim();
  const m = sinTildes(t).match(RE_TAREA);
  if (!m) return null;
  return t.slice(m[0].length) || t;
}

// Quita el verbo del inicio para que el registro rápido vea solo el monto y qué compré.
export function sinVerboDeGasto(texto: string) {
  return texto.replace(/^(gast[eé]|pagu[eé]|compr[eé]|anota(me)?|registra(me)?|apunta)\s+/i, '');
}
