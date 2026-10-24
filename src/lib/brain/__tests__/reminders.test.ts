// Pruebas del plan de avisos de vencimiento. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { HORA_AVISO, planExpiryReminders } from '@/lib/brain/reminders';

const AHORA = new Date(2026, 9, 24, 12, 0); // 24 de octubre de 2026, mediodía

describe('avisos de vencimiento', () => {
  test('un documento lejano recibe los tres avisos', () => {
    const avisos = planExpiryReminders([{ id: 1, nombre: 'SOAT', fecha_vencimiento: '2027-02-01' }], AHORA);
    expect(avisos.map((a) => a.cuando.getDate())).toEqual([2, 25, 31]);
    expect(avisos.every((a) => a.cuando.getHours() === HORA_AVISO)).toBe(true);
    expect(avisos[2].titulo).toBe('📄 SOAT vence mañana');
    expect(avisos[0].texto).toContain('1 de febrero de 2027');
  });

  test('salto los plazos que ya pasaron', () => {
    const avisos = planExpiryReminders([{ id: 2, nombre: 'Brevete', fecha_vencimiento: '2026-10-30' }], AHORA);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].titulo).toBe('📄 Brevete vence mañana');
  });

  test('ignoro documentos vencidos o sin fecha', () => {
    const avisos = planExpiryReminders(
      [
        { id: 3, nombre: 'DNI viejo', fecha_vencimiento: '2026-01-01' },
        { id: 4, nombre: 'Contrato', fecha_vencimiento: null },
      ],
      AHORA,
    );
    expect(avisos).toEqual([]);
  });

  test('ordeno los avisos de todos los documentos por fecha', () => {
    const avisos = planExpiryReminders(
      [
        { id: 5, nombre: 'A', fecha_vencimiento: '2027-06-01' },
        { id: 6, nombre: 'B', fecha_vencimiento: '2026-12-15' },
      ],
      AHORA,
    );
    const tiempos = avisos.map((a) => a.cuando.getTime());
    expect([...tiempos].sort((a, b) => a - b)).toEqual(tiempos);
    expect(avisos[0].docId).toBe(6);
  });
});
