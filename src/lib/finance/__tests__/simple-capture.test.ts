// Pruebas del registro rápido sin IA. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { parseSimple } from '@/lib/finance/simple-capture';

describe('registro rápido sin IA', () => {
  test('entiende monto, categoría y cuenta', () => {
    expect(parseSimple('25 menú con yape')).toMatchObject({ monto: 25, categoria: 'comida', cuenta: 'yape', tipo: 'gasto' });
  });

  test('sin cuenta dicha usa efectivo y acepta decimales con coma', () => {
    expect(parseSimple('taxi 12,50')).toMatchObject({ monto: 12.5, categoria: 'transporte', cuenta: 'efectivo' });
  });

  test('si no conoce la palabra deja que decida la IA', () => {
    expect(parseSimple('30 cosa para Ana')).toBeNull();
    expect(parseSimple('menú sin precio')).toBeNull();
  });

  test('ignora signos y tildes alrededor de la palabra', () => {
    expect(parseSimple('Menu, 15 soles')).toMatchObject({ monto: 15, categoria: 'comida' });
    expect(parseSimple('15 en el almuerzo.')).toMatchObject({ categoria: 'comida' });
    expect(parseSimple('Pagué 40 de luz con Plin')).toMatchObject({ categoria: 'servicios', cuenta: 'plin' });
  });

  test('entiende débito y crédito con tilde', () => {
    expect(parseSimple('20 cine con débito')).toMatchObject({ cuenta: 'debito' });
    expect(parseSimple('20 cine con tarjeta de crédito')).toMatchObject({ cuenta: 'credito' });
  });

  test('entiende plurales', () => {
    expect(parseSimple('8 pasajes')).toMatchObject({ categoria: 'transporte' });
  });

  test('lee montos con separador de miles', () => {
    expect(parseSimple('alquiler 1,200')).toMatchObject({ monto: 1200, categoria: 'casa' });
    expect(parseSimple('alquiler 1.250,50')).toMatchObject({ monto: 1250.5 });
    expect(parseSimple('S/. 35 farmacia')).toMatchObject({ monto: 35, categoria: 'salud' });
  });

  test('reconoce comercios y gastos comunes en Perú', () => {
    expect(parseSimple('120 plaza vea')).toMatchObject({ categoria: 'comida' });
    expect(parseSimple('45 netflix con credito')).toMatchObject({ categoria: 'servicios', cuenta: 'credito' });
    expect(parseSimple('60 grifo')).toMatchObject({ categoria: 'transporte' });
    expect(parseSimple('200 cuota de la tarjeta')).toMatchObject({ categoria: 'deudas' });
    expect(parseSimple('35 inkafarma')).toMatchObject({ categoria: 'salud' });
    expect(parseSimple('90 zapatillas')).toMatchObject({ categoria: 'ropa' });
  });

  test('reconoce ingresos sin IA', () => {
    expect(parseSimple('me pagaron 1200 por yape')).toMatchObject({ tipo: 'ingreso', monto: 1200, cuenta: 'yape' });
    expect(parseSimple('cobré 300')).toMatchObject({ tipo: 'ingreso', monto: 300 });
  });

  test('entiende "2 mil" y "1.5k"', () => {
    expect(parseSimple('2 mil de alquiler')).toMatchObject({ monto: 2000 });
    expect(parseSimple('sueldo 1.5k')).toMatchObject({ monto: 1500, tipo: 'ingreso' });
  });
});
