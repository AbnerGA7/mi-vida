// Pruebas de cuándo se recalcula el resumen en segundo plano. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { shouldRefreshBrief } from '@/lib/background/refresh';

const at = (dia: number, hora: number, min = 0) => new Date(2026, 9, dia, hora, min);

describe('resumen en segundo plano', () => {
  test('sin resumen previo siempre recalcula', () => {
    expect(shouldRefreshBrief(at(24, 3), null, 7)).toBe(true);
  });

  test('si el último es de ayer, recalcula aunque sea de madrugada', () => {
    expect(shouldRefreshBrief(at(24, 0, 30), at(23, 23).toISOString(), 7)).toBe(true);
  });

  test('de madrugada espera unas horas entre cálculos', () => {
    expect(shouldRefreshBrief(at(24, 2), at(24, 1).toISOString(), 7)).toBe(false);
    expect(shouldRefreshBrief(at(24, 5), at(24, 1).toISOString(), 7)).toBe(true);
  });

  test('después de la hora del resumen no gasta batería si ya hay uno de hoy', () => {
    expect(shouldRefreshBrief(at(24, 15), at(24, 8).toISOString(), 7)).toBe(false);
  });

  test('una fecha rota o en el futuro se trata como si no hubiera resumen', () => {
    expect(shouldRefreshBrief(at(24, 3), 'basura', 7)).toBe(true);
    expect(shouldRefreshBrief(at(24, 3), at(25, 3).toISOString(), 7)).toBe(true);
  });
});
