// Pruebas del progreso del Coach. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { isoWeek, tendencia, weeklyVolume, weightSeries } from '@/lib/coach/progress';

describe('semana ISO', () => {
  test('numero las semanas como en los registros', () => {
    expect(isoWeek(new Date(2026, 9, 24))).toBe('2026-S43');
  });

  test('los primeros días de enero pueden ser de la última semana del año anterior', () => {
    expect(isoWeek(new Date(2027, 0, 1))).toBe('2026-S53');
    expect(isoWeek(new Date(2027, 0, 4))).toBe('2027-S01');
  });
});

describe('progreso', () => {
  test('el peso salta semanas sin dato y queda en orden', () => {
    const serie = weightSeries([
      { semana: '2026-S43', peso_promedio: 79.4 },
      { semana: '2026-S41', peso_promedio: 80.2 },
      { semana: '2026-S42', peso_promedio: null },
    ]);
    expect(serie).toEqual([
      { etiqueta: 'S41', valor: 80.2 },
      { etiqueta: 'S43', valor: 79.4 },
    ]);
    expect(tendencia(serie)).toBe(-0.8);
  });

  test('el volumen suma peso por repeticiones de cada semana', () => {
    const vol = weeklyVolume([
      { fecha: '2026-10-19', peso_kg: 60, repeticiones: 10 },
      { fecha: '2026-10-21', peso_kg: 60, repeticiones: 8 },
      { fecha: '2026-10-26', peso_kg: 62.5, repeticiones: 10 },
    ]);
    expect(vol).toEqual([
      { etiqueta: 'S43', valor: 1080 },
      { etiqueta: 'S44', valor: 625 },
    ]);
  });

  test('con un solo punto no hay tendencia', () => {
    expect(tendencia([{ etiqueta: 'S43', valor: 80 }])).toBeNull();
  });
});
