// Metas de ahorro: las cuentas se hacen en código, igual que los presupuestos.

export type SavingsGoal = {
  id: number;
  nombre: string;
  meta: number;
  ahorrado: number;
  // AAAA-MM-DD; sin fecha la meta no tiene apuro.
  fecha_objetivo: string | null;
};

export type GoalProgress = {
  porcentaje: number;
  faltante: number;
  completa: boolean;
  // Meses que quedan hasta la fecha objetivo (al menos 1 si la fecha es este mes).
  mesesRestantes: number | null;
  // Lo que tendría que guardar cada mes para llegar a tiempo.
  cuotaMensual: number | null;
  atrasada: boolean;
};

function mesesEntre(hoy: Date, fecha: string) {
  const [y, m, d] = fecha.split('-').map(Number);
  let meses = (y - hoy.getFullYear()) * 12 + (m - 1 - hoy.getMonth());
  if (d < hoy.getDate()) meses -= 1;
  return meses;
}

export function goalProgress(goal: SavingsGoal, hoy = new Date()): GoalProgress {
  const faltante = Math.max(0, goal.meta - goal.ahorrado);
  const porcentaje = goal.meta > 0 ? Math.min(1, goal.ahorrado / goal.meta) : 0;
  const completa = faltante === 0;
  if (!goal.fecha_objetivo || completa) {
    return { porcentaje, faltante, completa, mesesRestantes: null, cuotaMensual: null, atrasada: false };
  }
  const meses = mesesEntre(hoy, goal.fecha_objetivo);
  const atrasada = meses < 0;
  const mesesRestantes = Math.max(1, meses);
  return {
    porcentaje,
    faltante,
    completa,
    mesesRestantes: atrasada ? 0 : mesesRestantes,
    cuotaMensual: atrasada ? faltante : Math.ceil((faltante / mesesRestantes) * 100) / 100,
    atrasada,
  };
}
