import { getDb } from '@/lib/db';
import { emitDataChanged } from '@/lib/events';
import { iso, parseTask, type Tarea } from '@/lib/task-parse';

export { parseTask, taskBucket, type Tarea } from '@/lib/task-parse';

export async function addTask(texto: string) {
  const { titulo, fecha_limite, prioridad } = parseTask(texto);
  if (!titulo) return null;
  const db = await getDb();
  const r = await db.runAsync('INSERT INTO tasks (titulo, fecha_limite, prioridad) VALUES (?, ?, ?)', titulo, fecha_limite, prioridad);
  emitDataChanged('tareas');
  return { id: r.lastInsertRowId, titulo, fecha_limite, prioridad };
}

export async function toggleTask(id: number) {
  const db = await getDb();
  await db.runAsync('UPDATE tasks SET hecha = 1 - hecha WHERE id = ?', id);
  emitDataChanged('tareas');
}

export async function deleteTask(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
  emitDataChanged('tareas');
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
