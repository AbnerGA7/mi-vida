// Pruebas de los pagos fijos. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { nextDueDate, planPaymentReminders, upcomingPayments, type Payment } from '@/lib/finance/payments';

const HOY = new Date(2026, 9, 24); // 24 de octubre de 2026

describe('pagos fijos', () => {
  test('si todavía no llega el día, vence este mes', () => {
    expect(nextDueDate(28, HOY)).toBe('2026-10-28');
  });

  test('el mismo día cuenta como este mes', () => {
    expect(nextDueDate(24, HOY)).toBe('2026-10-24');
  });

  test('si ya pasó, vence el mes siguiente', () => {
    expect(nextDueDate(5, HOY)).toBe('2026-11-05');
  });

  test('en meses cortos vence el último día', () => {
    expect(nextDueDate(31, new Date(2026, 10, 3))).toBe('2026-11-30');
    expect(nextDueDate(30, new Date(2027, 1, 1))).toBe('2027-02-28');
  });

  test('paso de diciembre a enero', () => {
    expect(nextDueDate(2, new Date(2026, 11, 20))).toBe('2027-01-02');
  });

  test('listo solo los que vencen pronto, del más cercano al más lejano', () => {
    const pagos: Payment[] = [
      { id: 1, nombre: 'Alquiler', monto: 900, dia: 1 },
      { id: 2, nombre: 'Luz', monto: 80, dia: 26 },
      { id: 3, nombre: 'Internet', monto: 99, dia: 15 },
      { id: 4, nombre: 'Tarjeta', monto: 300, dia: 24 },
    ];
    const prox = upcomingPayments(pagos, HOY, 8);
    expect(prox.map((p) => [p.nombre, p.dias])).toEqual([
      ['Tarjeta', 0],
      ['Luz', 2],
      ['Alquiler', 8],
    ]);
  });
});

describe('avisos de pago', () => {
  const AHORA = new Date(2026, 9, 24, 12, 0);

  test('aviso la víspera y el mismo día de los dos próximos vencimientos', () => {
    const avisos = planPaymentReminders([{ id: 1, nombre: 'Luz', monto: 80, dia: 28 }], AHORA);
    expect(avisos.map((a) => [a.cuando.getMonth() + 1, a.cuando.getDate(), a.cuando.getHours()])).toEqual([
      [10, 27, 19],
      [10, 28, 9],
      [11, 27, 19],
      [11, 28, 9],
    ]);
    expect(avisos[0].titulo).toBe('💳 Mañana pagas Luz');
  });

  test('si hoy vence y ya pasó la mañana, solo quedan los del mes siguiente', () => {
    const avisos = planPaymentReminders([{ id: 2, nombre: 'Tarjeta', monto: 300, dia: 24 }], AHORA);
    expect(avisos[0].cuando.getMonth()).toBe(10);
    expect(avisos).toHaveLength(2);
  });
});
