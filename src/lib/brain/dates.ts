// Detección de fechas en código: la IA pequeña se equivoca con fechas, las regex no.

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const pad = (n: number) => String(n).padStart(2, '0');

function iso(y: number, m: number, d: number) {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

type Found = { fecha: string; index: number };

export function findDates(texto: string): Found[] {
  const found: Found[] = [];
  const lower = texto.toLowerCase();

  for (const m of lower.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g)) {
    const f = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (f) found.push({ fecha: f, index: m.index! });
  }
  for (const m of lower.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const f = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (f) found.push({ fecha: f, index: m.index! });
  }
  for (const m of lower.matchAll(/\b(\d{1,2}) de ([a-z]+) (?:de(?:l)? )?(\d{4})\b/g)) {
    const mes = MESES[m[2]];
    const f = mes ? iso(Number(m[3]), mes, Number(m[1])) : null;
    if (f) found.push({ fecha: f, index: m.index! });
  }
  return found;
}

// Prefiero la fecha que aparece cerca de "vence", "vigencia" o "hasta"; si no, la más lejana.
export function findExpiration(texto: string): string | null {
  const dates = findDates(texto);
  if (dates.length === 0) return null;
  const lower = texto.toLowerCase();
  const near = dates.filter(({ index }) =>
    /venc|vigen|hasta|caduc|expira/.test(lower.slice(Math.max(0, index - 40), index)),
  );
  const pool = near.length > 0 ? near : dates;
  return pool.map((d) => d.fecha).sort().at(-1) ?? null;
}

export function daysUntil(fecha: string, today = new Date()) {
  const [y, m, d] = fecha.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - now) / 86400000);
}
