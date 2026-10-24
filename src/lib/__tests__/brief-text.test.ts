// Pruebas del texto del resumen del día. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { composeBrief, type BriefInput } from '@/lib/brief-text';
import type { Tarea } from '@/lib/task-parse';

const HOY = new Date(2026, 9, 24, 7, 0);
const vacio: BriefInput = { eventos: [], correos: [], tareas: [], budgets: [], spent: {}, docs: [], profile: null, pagos: [] };
const tarea = (titulo: string, fecha_limite: string | null, prioridad: Tarea['prioridad'] = 'media'): Tarea => ({
  id: 1,
  titulo,
  fecha_limite,
  prioridad,
  hecha: 0,
});

describe('resumen del día', () => {
  test('un día vacío dice que no hay reuniones y no inventa líneas', () => {
    expect(composeBrief(vacio, HOY)).toEqual({ titular: 'Sin reuniones.', lineas: [] });
  });

  test('lo más importante es la tarea urgente de prioridad alta', () => {
    const b = composeBrief({ ...vacio, tareas: [tarea('lavar', '2026-10-24'), tarea('pagar luz', '2026-10-23', 'alta')] }, HOY);
    expect(b.titular).toBe('Sin reuniones, lo más importante: pagar luz.');
    expect(b.lineas).toContain('✅ 2 tareas para hoy (1 vencida)');
  });

  test('escribe singular y plural bien en vez de "(s)"', () => {
    const correo = { id: '1', de: 'Banco', asunto: 'Estado', fragmento: '' };
    const b = composeBrief({ ...vacio, correos: [correo], tareas: [tarea('pan', '2026-10-24')] }, HOY);
    expect(b.lineas).toEqual(['✅ 1 tarea para hoy', '📧 1 correo importante sin leer']);
  });

  test('avisa de los pagos fijos de los próximos 3 días', () => {
    const b = composeBrief({ ...vacio, pagos: [{ id: 1, nombre: 'Luz', monto: 80, dia: 25 }, { id: 2, nombre: 'Alquiler', monto: 900, dia: 1 }] }, HOY);
    expect(b.lineas).toEqual(['💳 Luz S/ 80.00 (mañana)']);
  });

  test('marca los presupuestos en riesgo', () => {
    const b = composeBrief({ ...vacio, budgets: [{ categoria: 'comida', monto_mensual: 400 }], spent: { comida: 390 } }, HOY);
    expect(b.lineas[0]).toStartWith('💰 comida: S/ 390.00 de S/ 400.00');
  });

  test('lista los documentos que vencen esta semana', () => {
    const b = composeBrief({ ...vacio, docs: [{ nombre: 'SOAT', fecha_vencimiento: '2026-10-29' }, { nombre: 'DNI', fecha_vencimiento: '2030-01-01' }] }, HOY);
    expect(b.lineas).toEqual(['📄 SOAT (5 días)']);
  });

  test('dice "vence hoy" o "vencido hace" en vez de días negativos', () => {
    const docs = [
      { nombre: 'SOAT', fecha_vencimiento: '2026-10-24' },
      { nombre: 'Póliza', fecha_vencimiento: '2026-10-21' },
      { nombre: 'Brevete', fecha_vencimiento: '2026-10-25' },
    ];
    expect(composeBrief({ ...vacio, docs }, HOY).lineas).toEqual(['📄 SOAT (vence hoy) · Póliza (vencido hace 3 días) · Brevete (1 día)']);
  });
});
