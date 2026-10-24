// Pruebas de las metas de ahorro. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { goalProgress, type SavingsGoal } from '@/lib/finance/goals';

const HOY = new Date(2026, 9, 24); // 24 de octubre de 2026

const meta = (m: Partial<SavingsGoal>): SavingsGoal => ({ id: 1, nombre: 'Viaje', meta: 1200, ahorrado: 0, fecha_objetivo: null, ...m });

describe('metas de ahorro', () => {
  test('sin fecha solo calculo avance y faltante', () => {
    const p = goalProgress(meta({ ahorrado: 300 }), HOY);
    expect(p.porcentaje).toBe(0.25);
    expect(p.faltante).toBe(900);
    expect(p.cuotaMensual).toBeNull();
  });

  test('reparto lo que falta entre los meses que quedan', () => {
    const p = goalProgress(meta({ ahorrado: 200, fecha_objetivo: '2027-04-24' }), HOY);
    expect(p.mesesRestantes).toBe(6);
    expect(p.cuotaMensual).toBe(166.67);
  });

  test('si la fecha es este mismo mes cuento al menos un mes', () => {
    const p = goalProgress(meta({ fecha_objetivo: '2026-10-31' }), HOY);
    expect(p.mesesRestantes).toBe(1);
    expect(p.cuotaMensual).toBe(1200);
  });

  test('una meta vencida sin completar queda atrasada', () => {
    const p = goalProgress(meta({ ahorrado: 1000, fecha_objetivo: '2026-09-01' }), HOY);
    expect(p.atrasada).toBe(true);
    expect(p.cuotaMensual).toBe(200);
  });

  test('una meta superada queda completa y al 100%', () => {
    const p = goalProgress(meta({ ahorrado: 1500, fecha_objetivo: '2026-12-01' }), HOY);
    expect(p.completa).toBe(true);
    expect(p.porcentaje).toBe(1);
    expect(p.faltante).toBe(0);
    expect(p.atrasada).toBe(false);
  });
});
