// Cálculos de presupuesto en código, nunca con la IA, para que siempre cuadren.

export type BudgetStatus = 'ok' | 'en_riesgo' | 'excedido';

export type CategoryBudget = {
  categoria: string;
  presupuesto: number;
  gastado: number;
  restante: number;
  porcentaje: number;
  proyeccion: number;
  estado: BudgetStatus;
};

export type MonthlyBudget = { categoria: string; monto_mensual: number };
export type SpentByCategory = Record<string, number>;

// Fracción del mes transcurrida (1 de 30 → ~0.03, día 30 → 1).
export function monthProgress(today: Date) {
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return today.getDate() / days;
}

export function evaluateBudget(presupuesto: number, gastado: number, progreso: number): BudgetStatus {
  if (gastado > presupuesto) return 'excedido';
  const pctGastado = presupuesto > 0 ? gastado / presupuesto : 0;
  // En riesgo si voy más de 20 puntos por encima del ritmo del mes.
  return pctGastado - progreso > 0.2 ? 'en_riesgo' : 'ok';
}

export function summarizeBudgets(
  budgets: MonthlyBudget[],
  spent: SpentByCategory,
  today: Date,
): CategoryBudget[] {
  const progreso = monthProgress(today);
  return budgets
    .map(({ categoria, monto_mensual }) => {
      const gastado = spent[categoria] ?? 0;
      return {
        categoria,
        presupuesto: monto_mensual,
        gastado,
        restante: monto_mensual - gastado,
        porcentaje: monto_mensual > 0 ? gastado / monto_mensual : 0,
        proyeccion: progreso > 0 ? gastado / progreso : gastado,
        estado: evaluateBudget(monto_mensual, gastado, progreso),
      };
    })
    .sort((a, b) => b.porcentaje - a.porcentaje);
}

export function formatSoles(monto: number) {
  return `S/ ${monto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
