import { askAi, parseJson } from '@/lib/ai';
import { CATEGORIAS, CUENTAS, type NewTransaction } from '@/lib/finance/repository';

// Palabras comunes que resuelvo sin IA: rápido y sin gastar batería.
const KEYWORDS: Record<string, (typeof CATEGORIAS)[number]> = {
  menu: 'comida', menú: 'comida', almuerzo: 'comida', cena: 'comida', desayuno: 'comida', pollo: 'comida',
  pasaje: 'transporte', combi: 'transporte', taxi: 'transporte', uber: 'transporte', bus: 'transporte',
  alquiler: 'casa', cuarto: 'casa', luz: 'servicios', agua: 'servicios', internet: 'servicios', celular: 'servicios',
  farmacia: 'salud', doctor: 'salud', gym: 'gym', gimnasio: 'gym', proteina: 'gym',
  libro: 'estudios', curso: 'estudios', universidad: 'estudios', cine: 'ocio', salida: 'ocio',
};

export function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseSimple(texto: string): NewTransaction | null {
  const lower = texto.toLowerCase();
  const monto = lower.match(/(\d+(?:[.,]\d{1,2})?)/);
  if (!monto) return null;

  const words = lower.split(/\s+/);
  const categoria = words.map((w) => KEYWORDS[w]).find(Boolean);
  if (!categoria) return null;

  const cuenta = CUENTAS.find((c) => words.includes(c)) ?? 'efectivo';

  return {
    fecha: today(),
    monto: Number(monto[1].replace(',', '.')),
    tipo: 'gasto',
    descripcion: texto.trim(),
    categoria,
    cuenta,
  };
}

const SYSTEM = `Convierte el texto de un gasto o ingreso en soles peruanos a JSON.
Responde SOLO con JSON: {"monto": number, "tipo": "gasto"|"ingreso", "categoria": string, "cuenta": string, "descripcion": string}
categoria debe ser una de: ${CATEGORIAS.join(', ')}.
cuenta debe ser una de: ${CUENTAS.join(', ')} (si no se dice, "efectivo").
No des consejos de inversión.`;

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
  // Finanzas siempre en modo privado: el texto no sale del celular.
  const { text } = await askAi(
    [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: texto },
    ],
    { privado: true, maxTokens: 120, temperature: 0, json: SCHEMA },
  );
  const json = parseJson(text);
  const monto = Number(json.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('No encontré el monto');

  return {
    fecha: today(),
    monto,
    tipo: json.tipo === 'ingreso' ? 'ingreso' : 'gasto',
    descripcion: String(json.descripcion || texto).trim(),
    categoria: CATEGORIAS.includes(json.categoria) ? json.categoria : 'otros',
    cuenta: CUENTAS.includes(json.cuenta) ? json.cuenta : 'efectivo',
  };
}

// Ingresos y frases raras van a la IA; lo común se resuelve al toque.
export async function quickCapture(texto: string) {
  const esIngreso = /\b(cobr[eé]|me pagaron|sueldo|ingreso)\b/i.test(texto);
  return (!esIngreso && parseSimple(texto)) || parseWithAi(texto);
}
