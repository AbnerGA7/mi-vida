// Detección de fechas en código: la IA pequeña se equivoca con fechas, las regex no.

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, sept: 9, set: 9, oct: 10, nov: 11, dic: 12,
};
const MES = Object.keys(MESES).sort((a, b) => b.length - a.length).join('|');

const pad = (n: number) => String(n).padStart(2, '0');

// Solo acepto fechas que existen de verdad (nada de 31/02) y en un rango de años razonable.
function iso(y: number, m: number, d: number) {
  if (y < 100) y += y > 70 ? 1900 : 2000;
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// El OCR confunde letras con números ("2O27", "l5/03"). Arreglo solo dentro de bloques que parecen fechas
// y normalizo los espacios alrededor de las barras ("15 / 03 / 2027").
export function cleanOcr(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[0-9oil|]{1,4}(?:\s?[/.\-]\s?[0-9oil|]{1,4}){2}/g, (m) =>
      /\d/.test(m) ? m.replace(/\s/g, '').replace(/o/g, '0').replace(/[il|]/g, '1') : m,
    );
}

type Found = { fecha: string; index: number };

export function findDates(texto: string): Found[] {
  const found: Found[] = [];
  const lower = cleanOcr(texto);
  const add = (f: string | null, index: number) => {
    if (f && !found.some((x) => x.index === index)) found.push({ fecha: f, index });
  };

  // 2027-03-15 o 2027/03/15
  for (const m of lower.matchAll(/\b(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})\b/g)) {
    add(iso(Number(m[1]), Number(m[2]), Number(m[3])), m.index!);
  }
  // 15/03/2027, 15-03-27, 15.03.2027 (en Perú siempre día primero)
  for (const m of lower.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})\b/g)) {
    add(iso(Number(m[3]), Number(m[2]), Number(m[1])), m.index!);
  }
  // 15-mar-2027, 15/MAR/27, 15 mar 2027, 31 de diciembre de 2026, 31 de diciembre del 2026, 31 de dic. 2026
  const textual = new RegExp(`\\b(\\d{1,2})(?:\\s*de\\s*|[\\s/.-]+)(${MES})\\.?(?:\\s*(?:de(?:l)?\\s*|,\\s*)|[\\s/.-]+)(\\d{4}|\\d{2})\\b`, 'g');
  for (const m of lower.matchAll(textual)) {
    add(iso(Number(m[3]), MESES[m[2]], Number(m[1])), m.index!);
  }
  // marzo 15, 2027 / marzo 15 de 2027
  const mesPrimero = new RegExp(`\\b(${MES})\\.?\\s+(\\d{1,2}),?\\s+(?:de(?:l)?\\s+)?(\\d{4})\\b`, 'g');
  for (const m of lower.matchAll(mesPrimero)) {
    add(iso(Number(m[3]), MESES[m[1]], Number(m[2])), m.index!);
  }
  return found.sort((a, b) => a.index - b.index);
}

// Palabras que aparecen antes de la fecha de vencimiento…
const POSITIVAS = /(venc\w*|vigen\w*|hasta|valid[oa]?\s+hasta|caduc\w*|revalidac\w*|expira\w*|fin\s+de\s+vigencia|fecha\s+limite|renovar\s+antes)/g;
// …y las que marcan fechas que NO son el vencimiento.
const NEGATIVAS = /(inicio\s+de\s+(?:la\s+)?vigencia|vigencia\s+desde|emision|emitid\w*|expedi\w*|nacimiento|nacid\w*|inscripcion|impresion|impreso|desde|inicio|otorgamiento|registro|firma|suscri\w*|celebrad\w*|atencion)/g;
// "del 01/01/2026 al 01/01/2027": solo cuentan si van pegadas a la fecha (si no, "vencimiento del SOAT" confunde).
const DEBILES: [RegExp, number][] = [[/\bal\s*:?\s*$/, 1], [/\bdel\s*:?\s*$/, -1]];

// Busco la palabra clave más cercana antes de la fecha (en ~60 caracteres) y le doy un puntaje.
function score(lower: string, index: number) {
  const before = lower.slice(Math.max(0, index - 60), index);
  for (const [re, valor] of DEBILES) if (re.test(before)) return valor * 2;
  // Gana la palabra que termina más cerca de la fecha; en empate, la más larga
  // ("inicio de vigencia" le gana a "vigencia").
  let best = { fin: -1, largo: 0, valor: 0 };
  for (const [re, valor] of [[POSITIVAS, 1], [NEGATIVAS, -1]] as const) {
    for (const m of before.matchAll(re)) {
      const fin = m.index! + m[0].length;
      if (fin > best.fin || (fin === best.fin && m[0].length > best.largo)) best = { fin, largo: m[0].length, valor };
    }
  }
  if (best.fin < 0) return 0;
  // Más cerca de la fecha → más peso.
  const distancia = before.length - best.fin;
  return best.valor * (distancia < 25 ? 2 : 1);
}

export function addYears(fecha: string, years: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  return iso(y + years, m, Math.min(d, new Date(Date.UTC(y + years, m, 0)).getUTCDate()));
}

export type ExpirationHint = {
  // Documentos que duran un plazo fijo desde que empiezan (el SOAT dura 1 año).
  vigenciaAnios?: number;
  hoy?: Date;
};

// Elijo la fecha con mejor puntaje (la más cercana a "vence", "vigencia", "hasta", "caducidad").
// En empate gana la más lejana. Una fecha sin palabra clave solo cuenta si es futura (una fecha pasada
// suelta es casi siempre la de emisión). Si todas son de emisión o nacimiento, no hay vencimiento.
export function findExpiration(texto: string, hint: ExpirationHint = {}): string | null {
  const dates = findDates(texto);
  if (dates.length === 0) return null;
  const lower = cleanOcr(texto);
  const scored = dates.map((d) => ({ ...d, s: score(lower, d.index) }));

  const buenas = scored.filter((d) => d.s > 0);
  const hoy = hint.hoy ?? new Date();
  const neutras = scored.filter((d) => d.s === 0 && daysUntil(d.fecha, hoy) > 0);
  const pool = buenas.length > 0 ? buenas : neutras;
  if (pool.length > 0) {
    const max = Math.max(...pool.map((d) => d.s));
    return pool.filter((d) => d.s === max).map((d) => d.fecha).sort().at(-1) ?? null;
  }
  // Solo encontré la fecha de inicio: si sé cuánto dura el documento, calculo el fin.
  if (hint.vigenciaAnios) {
    const inicio = scored.filter((d) => /desde|inicio|del\b|emision/.test(lower.slice(Math.max(0, d.index - 40), d.index)));
    const base = inicio.map((d) => d.fecha).sort().at(-1);
    if (base) return addYears(base, hint.vigenciaAnios);
  }
  return null;
}

export function daysUntil(fecha: string, today = new Date()) {
  const [y, m, d] = fecha.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86400000);
}

const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre'];

// "2027-03-15" → "15 de marzo de 2027" (para mostrar y para leer en voz alta).
export function formatFecha(fecha: string, conAnio = true) {
  const [y, m, d] = fecha.split('-').map(Number);
  if (!y || !m || !d) return fecha;
  return `${d} de ${NOMBRES_MES[m - 1]}${conAnio ? ` de ${y}` : ''}`;
}
