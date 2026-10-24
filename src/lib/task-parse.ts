// Tareas en una línea: entiendo la fecha y la prioridad en código, sin IA ni base de datos.
export type Tarea = { id: number; titulo: string; fecha_limite: string | null; prioridad: 'alta' | 'media'; hecha: number };

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// "pagar luz el viernes!" → { titulo: "pagar luz", fecha: próximo viernes, prioridad: alta }. Sin IA.
export function parseTask(texto: string, today = new Date()) {
  let t = texto.trim();
  const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  let fecha: Date | null = null;

  const prioridad: Tarea['prioridad'] = /!|\burgente\b/i.test(t) ? 'alta' : 'media';
  t = t.replace(/!+/g, '').replace(/\burgente\b/gi, '');

  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const reglas: [RegExp, () => Date][] = [
    [/\bpasado manana\b/, () => new Date(base.getTime() + 2 * 86400000)],
    [/\bmanana\b/, () => new Date(base.getTime() + 86400000)],
    [/\bhoy\b/, () => base],
  ];
  for (const [re, f] of reglas) {
    const m = sinTildes(t).match(re);
    if (m) {
      fecha = f();
      t = t.slice(0, m.index) + t.slice(m.index! + m[0].length);
      break;
    }
  }

  if (!fecha) {
    const m = sinTildes(t).match(/\b(?:el )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
    if (m) {
      const objetivo = DIAS.indexOf(m[1]);
      const dif = (objetivo - base.getDay() + 7) % 7 || 7;
      fecha = new Date(base.getTime() + dif * 86400000);
      t = t.slice(0, m.index) + t.slice(m.index! + m[0].length);
    }
  }

  if (!fecha) {
    const m = t.match(/\b(\d{1,2})\/(\d{1,2})\b/);
    const dia = Number(m?.[1]);
    const mes = Number(m?.[2]) - 1;
    // Date corre los días que sobran ("31/02" sería 3 de marzo): solo acepto fechas que existen.
    const existe = (y: number) => new Date(y, mes, dia).getMonth() === mes;
    if (m && mes >= 0 && mes < 12 && dia >= 1) {
      let y = base.getFullYear();
      if (new Date(y, mes, dia) < base) y++;
      // El 29/02 solo existe en bisiestos: busco el próximo que lo tenga.
      for (let i = 0; i < 4 && !existe(y); i++) y++;
      if (existe(y)) {
        fecha = new Date(y, mes, dia);
        t = t.replace(m[0], '');
      }
    }
  }

  return { titulo: t.replace(/\s+/g, ' ').trim(), fecha_limite: fecha ? iso(fecha) : null, prioridad };
}

export function taskBucket(t: Tarea, today = new Date()) {
  if (!t.fecha_limite) return 'sin fecha';
  const hoy = iso(today);
  if (t.fecha_limite < hoy) return 'vencida';
  if (t.fecha_limite === hoy) return 'hoy';
  return 'próximos días';
}
