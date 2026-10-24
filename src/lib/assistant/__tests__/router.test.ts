// Pruebas del enrutador del asistente central. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { routeQuestion } from '@/lib/assistant/router';

describe('asistente central', () => {
  test.each([
    ['¿Cuánto gasté en comida este mes?', { modulo: 'plata', tema: 'categoria', categoria: 'comida' }],
    ['cuanto he gastado en taxi', { modulo: 'plata', tema: 'categoria', categoria: 'transporte' }],
    ['¿Cuánto gasté?', { modulo: 'plata', tema: 'balance' }],
    ['¿Cómo va mi balance?', { modulo: 'plata', tema: 'balance' }],
    ['¿Cuánto llevo ahorrado para el viaje?', { modulo: 'plata', tema: 'metas' }],
    ['¿Qué pagos tengo esta semana?', { modulo: 'plata', tema: 'pagos' }],
    ['¿Cómo van mis presupuestos?', { modulo: 'plata', tema: 'presupuestos' }],
    ['¿Cuántas calorías me tocan?', { modulo: 'coach', tema: 'calorias' }],
    ['¿Qué rutina me toca hoy?', { modulo: 'coach', tema: 'rutina' }],
    ['¿Qué tareas tengo pendientes?', { modulo: 'tareas' }],
    ['¿Cuándo vence mi SOAT?', { modulo: 'cerebro' }],
    ['¿Cuándo tengo que pagar la póliza del seguro?', { modulo: 'cerebro' }],
  ])('%s', (pregunta, ruta) => {
    expect(routeQuestion(pregunta)).toEqual(ruta as never);
  });

  test('lo que no reconozco queda para la IA', () => {
    expect(routeQuestion('Cuéntame un chiste')).toBeNull();
  });
});
