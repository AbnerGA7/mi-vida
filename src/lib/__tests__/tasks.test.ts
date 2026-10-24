// Pruebas de las tareas en una línea. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { parseTask, taskBucket, type Tarea } from '@/lib/task-parse';

const HOY = new Date(2026, 9, 24); // sábado 24 de octubre de 2026

describe('tareas en lenguaje natural', () => {
  test('"!" marca prioridad alta y el día de la semana va al próximo', () => {
    expect(parseTask('pagar luz el viernes!', HOY)).toEqual({ titulo: 'pagar luz', fecha_limite: '2026-10-30', prioridad: 'alta' });
  });

  test('el mismo día de la semana es la semana siguiente', () => {
    expect(parseTask('lavar ropa el sábado', HOY).fecha_limite).toBe('2026-10-31');
  });

  test('entiende hoy, mañana y pasado mañana con o sin tilde', () => {
    expect(parseTask('comprar pan hoy', HOY).fecha_limite).toBe('2026-10-24');
    expect(parseTask('llamar a mamá mañana', HOY)).toMatchObject({ titulo: 'llamar a mamá', fecha_limite: '2026-10-25' });
    expect(parseTask('revisar notas pasado manana', HOY).fecha_limite).toBe('2026-10-26');
  });

  test('"urgente" también sube la prioridad y se borra del título', () => {
    expect(parseTask('urgente renovar DNI', HOY)).toMatchObject({ titulo: 'renovar DNI', prioridad: 'alta' });
  });

  test('una fecha corta que ya pasó salta al año siguiente', () => {
    expect(parseTask('cita dentista 15/03', HOY).fecha_limite).toBe('2027-03-15');
    expect(parseTask('cumple de Ana 05/11', HOY).fecha_limite).toBe('2026-11-05');
  });

  test('sin fecha ni prioridad queda como tarea media sin fecha', () => {
    expect(parseTask('  leer   un libro ', HOY)).toEqual({ titulo: 'leer un libro', fecha_limite: null, prioridad: 'media' });
  });
});

describe('grupos de tareas', () => {
  const t = (fecha_limite: string | null): Tarea => ({ id: 1, titulo: 'x', fecha_limite, prioridad: 'media', hecha: 0 });

  test('clasifica vencida, hoy, próximos días y sin fecha', () => {
    expect(taskBucket(t('2026-10-23'), HOY)).toBe('vencida');
    expect(taskBucket(t('2026-10-24'), HOY)).toBe('hoy');
    expect(taskBucket(t('2026-10-26'), HOY)).toBe('próximos días');
    expect(taskBucket(t(null), HOY)).toBe('sin fecha');
  });
});
