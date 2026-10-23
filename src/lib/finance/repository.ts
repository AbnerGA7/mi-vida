import { getDb } from '@/lib/db';
import type { MonthlyBudget, SpentByCategory } from '@/lib/finance/budget';

export const CATEGORIAS = [
  'comida',
  'transporte',
  'casa',
  'servicios',
  'salud',
  'gym',
  'estudios',
  'ocio',
  'ropa',
  'deudas',
  'otros',
] as const;

export const CUENTAS = ['efectivo', 'yape', 'plin', 'debito', 'credito'] as const;

export type Transaction = {
  id: number;
  fecha: string;
  monto: number;
  tipo: 'gasto' | 'ingreso';
  descripcion: string;
  categoria: string;
  cuenta: string;
};

export type NewTransaction = Omit<Transaction, 'id'>;

function monthRange(today: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const ym = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
  return { desde: `${ym}-01`, hasta: `${ym}-31` };
}

export async function addTransaction(t: NewTransaction) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO transactions (fecha, monto, tipo, descripcion, categoria, cuenta) VALUES (?, ?, ?, ?, ?, ?)',
    t.fecha,
    t.monto,
    t.tipo,
    t.descripcion,
    t.categoria,
    t.cuenta,
  );
}

export async function deleteTransaction(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
}

export async function listMonthTransactions(today = new Date()) {
  const db = await getDb();
  const { desde, hasta } = monthRange(today);
  return db.getAllAsync<Transaction>(
    'SELECT * FROM transactions WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC',
    desde,
    hasta,
  );
}

export async function spentByCategory(today = new Date()): Promise<SpentByCategory> {
  const db = await getDb();
  const { desde, hasta } = monthRange(today);
  const rows = await db.getAllAsync<{ categoria: string; total: number }>(
    `SELECT categoria, SUM(monto) AS total FROM transactions
     WHERE tipo = 'gasto' AND fecha BETWEEN ? AND ? GROUP BY categoria`,
    desde,
    hasta,
  );
  return Object.fromEntries(rows.map((r) => [r.categoria, r.total]));
}

export async function monthTotals(today = new Date()) {
  const db = await getDb();
  const { desde, hasta } = monthRange(today);
  const row = await db.getFirstAsync<{ ingresos: number | null; gastos: number | null }>(
    `SELECT SUM(CASE WHEN tipo = 'ingreso' THEN monto END) AS ingresos,
            SUM(CASE WHEN tipo = 'gasto' THEN monto END) AS gastos
     FROM transactions WHERE fecha BETWEEN ? AND ?`,
    desde,
    hasta,
  );
  return { ingresos: row?.ingresos ?? 0, gastos: row?.gastos ?? 0 };
}

export async function listBudgets() {
  const db = await getDb();
  return db.getAllAsync<MonthlyBudget>('SELECT * FROM budgets ORDER BY categoria');
}

export async function setBudget(categoria: string, monto_mensual: number) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO budgets (categoria, monto_mensual) VALUES (?, ?) ON CONFLICT(categoria) DO UPDATE SET monto_mensual = excluded.monto_mensual',
    categoria,
    monto_mensual,
  );
}
