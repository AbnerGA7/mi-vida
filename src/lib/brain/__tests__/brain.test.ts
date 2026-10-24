// Pruebas de la IA en código del segundo cerebro. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { detectIntent, fastAnswer, pasajes, toFtsQuery, type DocLite } from '@/lib/brain/answer';
import { classifyByRules, extractFields, tipoDesdePregunta } from '@/lib/brain/classify';
import { findDates, findExpiration } from '@/lib/brain/dates';
import { fixDictation, textoParaVoz } from '@/lib/voice-text';

const HOY = new Date(2026, 9, 24); // 24 de octubre de 2026

// Textos como los devuelve el OCR de ML Kit: mayúsculas, saltos raros y alguna letra cambiada.
const MUESTRAS: { nombre: string; texto: string; tipo: string | null; categoria: string; vence: string | null }[] = [
  {
    nombre: 'Escaneo 24/10/2026',
    texto: `RIMAC SEGUROS
CERTIFICADO SOAT
SEGURO OBLIGATORIO DE ACCIDENTES DE TRANSITO
N° POLIZA 2215-00483921
PLACA: ABC-123  CLASE: AUTOMOVIL
VIGENCIA
DESDE         HASTA
15/03/2026    15/03/2027
FECHA DE EMISION 14/03/2026`,
    tipo: 'SOAT',
    categoria: 'Seguros',
    vence: '2027-03-15',
  },
  {
    nombre: 'soat_moto.pdf',
    texto: `[Página 1]
LA POSITIVA SEGUROS
Certificado SOAT electrónico
Placa N°: 1234-AB
Vigencia del 01/O2/2026 al 0l/02/2027
Precio S/ 95.00`,
    tipo: 'SOAT',
    categoria: 'Seguros',
    vence: '2027-02-01',
  },
  {
    nombre: 'Escaneo 01/10/2026',
    texto: `SOAT PACIFICO
PLACA BXR-456
INICIO DE VIGENCIA 10 de setiembre de 2026`,
    tipo: 'SOAT',
    categoria: 'Seguros',
    vence: '2027-09-10', // solo tiene inicio: el SOAT dura un año
  },
  {
    nombre: 'dni.jpg',
    texto: `REPUBLICA DEL PERU
DOCUMENTO NACIONAL DE IDENTIDAD
DNI 71234567
Apellidos GONZALES
Fecha de Nacimiento 12 05 1998
Fecha de Emisión 03/02/2020
Fecha de Caducidad 03/02/2028`,
    tipo: 'DNI',
    categoria: 'Identidad y trámites',
    vence: '2028-02-03',
  },
  {
    nombre: 'licencia.png',
    texto: `MINISTERIO DE TRANSPORTES Y COMUNICACIONES MTC
LICENCIA DE CONDUCIR
CLASE A CATEGORIA I
FECHA DE EXPEDICION 20-JUN-2023
REVALIDACION 20-JUN-2033`,
    tipo: 'Brevete',
    categoria: 'Vehículos',
    vence: '2033-06-20',
  },
  {
    nombre: 'contrato depa.pdf',
    texto: `CONTRATO DE ARRENDAMIENTO
Conste por el presente documento que celebran de una parte el ARRENDADOR ... y de otra parte EL ARRENDATARIO ...
CLAUSULA TERCERA: La merced conductiva es de S/ 1,200.00 mensuales.
CLAUSULA CUARTA: El plazo es de un año, del 1 de agosto de 2026 al 31 de julio de 2027.
Firmado en Lima el 28 de julio de 2026`,
    tipo: 'Contrato de alquiler',
    categoria: 'Contratos',
    vence: '2027-07-31',
  },
  {
    nombre: 'recibo.jpg',
    texto: `LUZ DEL SUR
Suministro 1234567
Consumo 145 kWh
Fecha de emisión 05/10/2026
Fecha de vencimiento 20/10/2026
Total a pagar S/ 98.40`,
    tipo: 'Recibo de luz',
    categoria: 'Hogar',
    vence: '2026-10-20',
  },
  {
    nombre: 'revision.jpg',
    texto: `CERTIFICADO DE INSPECCION TECNICA VEHICULAR
Placa ABC-123
Fecha de inspección 02/05/2026
Válido hasta 02/05/2027`,
    tipo: 'Revisión técnica',
    categoria: 'Vehículos',
    vence: '2027-05-02',
  },
  {
    nombre: 'eps.pdf',
    texto: `PACIFICO EPS
Plan de Salud Familiar
Póliza 98765432
Deducible S/ 30 Copago 20%
Vigencia hasta el 31 de diciembre de 2026`,
    tipo: 'Seguro de salud',
    categoria: 'Seguros',
    vence: '2026-12-31',
  },
  {
    nombre: 'boleta setiembre.pdf',
    texto: `BOLETA DE PAGO
Periodo: 09/2026
Remuneración básica 2,500.00
AFP Integra 250.00
Total neto 2,150.00`,
    tipo: 'Boleta de pago',
    categoria: 'Finanzas e impuestos',
    vence: null,
  },
  {
    nombre: 'bachiller.pdf',
    texto: `UNIVERSIDAD NACIONAL DE INGENIERIA
Otorga el Grado Académico de Bachiller en Ingeniería de Sistemas
Lima, 15 de diciembre de 2024
Registrado en SUNEDU`,
    tipo: 'Certificado de estudios',
    categoria: 'Estudios',
    vence: null,
  },
  {
    nombre: 'nota.txt',
    texto: 'Recordar comprar regalo para mamá. Llamar a Juan.',
    tipo: null,
    categoria: 'Notas personales',
    vence: null,
  },
];

describe('clasificación por reglas', () => {
  for (const m of MUESTRAS) {
    test(`${m.nombre} → ${m.tipo ?? 'sin tipo'}`, () => {
      const r = classifyByRules(m.nombre, m.texto);
      expect(r.tipo).toBe(m.tipo);
      expect(r.categoria).toBe(m.categoria);
      if (m.tipo) expect(r.seguro).toBe(true);
    });
  }

  test('lee placa, aseguradora y últimos 4 de la póliza', () => {
    expect(extractFields(MUESTRAS[0].texto)).toEqual({ placa: 'ABC-123', aseguradora: 'Rímac', poliza: '3921' });
  });
});
