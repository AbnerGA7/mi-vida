import { getDb } from '@/lib/db';

export type Tarea = { id: number; titulo: string; fecha_limite: string | null; prioridad: 'alta' | 'media'; hecha: number };

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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
    if (m) {
      fecha = new Date(base.getFullYear(), Number(m[2]) - 1, Number(m[1]));
      if (fecha < base) fecha.setFullYear(fecha.getFullYear() + 1);
      t = t.replace(m[0], '');
    }
  }

  return { titulo: t.replace(/\s+/g, ' ').trim(), fecha_limite: fecha ? iso(fecha) : null, prioridad };
}

export async function addTask(texto: string) {
  const { titulo, fecha_limite, prioridad } = parseTask(texto);
  if (!titulo) return;
  const db = await getDb();
  await db.runAsync('INSERT INTO tasks (titulo, fecha_limite, prioridad) VALUES (?, ?, ?)', titulo, fecha_limite, prioridad);
}

export async function toggleTask(id: number) {
  const db = await getDb();
  await db.runAsync('UPDATE tasks SET hecha = 1 - hecha WHERE id = ?', id);
}

export async function deleteTask(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
}

// Pendientes vencidas, de hoy y de los próximos 3 días, más las sin fecha.
export async function upcomingTasks(today = new Date()) {
  const db = await getDb();
  const limite = iso(new Date(today.getTime() + 3 * 86400000));
  return db.getAllAsync<Tarea>(
    `SELECT * FROM tasks WHERE hecha = 0 AND (fecha_limite IS NULL OR fecha_limite <= ?)
     ORDER BY fecha_limite IS NULL, fecha_limite, prioridad = 'alta' DESC, id`,
    limite,
  );
}

export function taskBucket(t: Tarea, today = new Date()) {
  if (!t.fecha_limite) return 'sin fecha';
  const hoy = iso(today);
  if (t.fecha_limite < hoy) return 'vencida';
  if (t.fecha_limite === hoy) return 'hoy';
  return 'próximos días';
}
