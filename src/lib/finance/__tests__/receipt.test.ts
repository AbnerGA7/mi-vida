// Pruebas de la lectura de boletas. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { categoriaDe, findComercio, findTotal, parseReceipt } from '@/lib/finance/receipt';

// Textos como los devuelve el OCR de ML Kit al fotografiar boletas.
const TOTTUS = `HIPERMERCADOS TOTTUS S.A.
RUC 20508565934
AV. ANGAMOS ESTE 1805
BOLETA DE VENTA ELECTRONICA
B123-00045678
FECHA: 22/10/2026 18:45
ARROZ COSTEÑO 5KG    24.90
LECHE GLORIA X6      23.40
OP. GRAVADA S/       40.17
IGV 18% S/            7.23
TOTAL S/             48.30
EFECTIVO             50.00
VUELTO                1.70`;

const FARMACIA = `InkaFarma
RUC 20512002090
Boleta Electrónica
SUBTOTAL   35,50
IMPORTE TOTAL
S/ 35,50`;

const GRIFO = `PRIMAX
ESTACION DE SERVICIO
GASOHOL 90 PLUS
TOTAL A PAGAR: S/ 1,150.00`;

describe('boletas', () => {
  test('tomo el total y no el subtotal, la op. gravada ni el vuelto', () => {
    expect(findTotal(TOTTUS)).toBe(48.3);
  });

  test('leo el total aunque esté en la línea siguiente y con coma decimal', () => {
    expect(findTotal(FARMACIA)).toBe(35.5);
  });

  test('entiendo miles con coma', () => {
    expect(findTotal(GRIFO)).toBe(1150);
  });

  test('sin la palabra total uso el mayor monto en soles', () => {
    expect(findTotal('MENU DEL DIA S/ 12.00\nGASEOSA S/ 3.50')).toBe(12);
  });

  test('el comercio es la primera línea con letras antes del RUC', () => {
    expect(findComercio(TOTTUS)).toBe('HIPERMERCADOS TOTTUS S.A.');
    expect(findComercio(FARMACIA)).toBe('InkaFarma');
  });

  test('reconozco la categoría por la tienda', () => {
    expect(categoriaDe('HIPERMERCADOS TOTTUS S.A.')).toBe('comida');
    expect(categoriaDe('InkaFarma')).toBe('salud');
    expect(categoriaDe('PRIMAX')).toBe('transporte');
    expect(categoriaDe('Ferretería Don Pepe')).toBe('otros');
  });

  test('armo la boleta completa con fecha', () => {
    expect(parseReceipt(TOTTUS)).toEqual({ monto: 48.3, comercio: 'HIPERMERCADOS TOTTUS S.A.', fecha: '2026-10-22', categoria: 'comida' });
  });

  test('si no hay montos no invento nada', () => {
    expect(parseReceipt('Gracias por su compra')).toBeNull();
  });
});
