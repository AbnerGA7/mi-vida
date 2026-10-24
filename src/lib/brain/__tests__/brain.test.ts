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

describe('fecha de vencimiento', () => {
  for (const m of MUESTRAS) {
    test(`${m.nombre} → ${m.vence}`, () => {
      const r = classifyByRules(m.nombre, m.texto);
      expect(findExpiration(m.texto, { vigenciaAnios: r.vigenciaAnios, hoy: HOY })).toBe(m.vence);
    });
  }

  test('rechaza fechas que no existen', () => {
    expect(findDates('31/02/2027 y 30/02/2026')).toEqual([]);
  });

  test('entiende formatos variados', () => {
    const f = (t: string) => findDates(t).map((d) => d.fecha);
    expect(f('2027-03-15')).toEqual(['2027-03-15']);
    expect(f('15 / 03 / 2027')).toEqual(['2027-03-15']);
    expect(f('15-MAR-27')).toEqual(['2027-03-15']);
    expect(f('15 de marzo del 2027')).toEqual(['2027-03-15']);
    expect(f('15 dic. 2026')).toEqual(['2026-12-15']);
    expect(f('marzo 15, 2027')).toEqual(['2027-03-15']);
  });

  test('"vencimiento del SOAT:" no confunde el "del" con una fecha de inicio', () => {
    expect(findExpiration('Fecha de vencimiento del SOAT: 15/03/2027. Emitido 14/03/2026')).toBe('2027-03-15');
  });

  test('si solo hay fecha de nacimiento, no hay vencimiento', () => {
    expect(findExpiration('Fecha de nacimiento 12/05/1998')).toBeNull();
  });
});


const DOCS: DocLite[] = [
  { id: 1, nombre: 'SOAT 24/10/2026', categoria: 'Seguros', resumen: 'SOAT · Rímac · placa ABC-123', texto: MUESTRAS[0].texto, fecha_vencimiento: '2027-03-15' },
  { id: 2, nombre: 'dni.jpg', categoria: 'Identidad y trámites', resumen: 'DNI', texto: MUESTRAS[3].texto, fecha_vencimiento: '2028-02-03' },
  { id: 3, nombre: 'recibo.jpg', categoria: 'Hogar', resumen: 'Recibo de luz', texto: MUESTRAS[6].texto, fecha_vencimiento: '2026-10-20' },
  { id: 4, nombre: 'eps.pdf', categoria: 'Seguros', resumen: 'Seguro de salud · Pacífico', texto: MUESTRAS[8].texto, fecha_vencimiento: '2026-12-31' },
];

describe('preguntas', () => {
  test('detecta la intención', () => {
    expect(detectIntent('¿Cuándo vence mi SOAT?')).toBe('vencimiento');
    expect(detectIntent('hasta cuando es mi dni')).toBe('vencimiento');
    expect(detectIntent('¿mi soat está vigente?')).toBe('vigente');
    expect(detectIntent('¿qué documentos se vencen pronto?')).toBe('por_vencer');
    expect(detectIntent('¿qué documentos tengo?')).toBe('listar');
    expect(detectIntent('¿cuánto pago de alquiler?')).toBeNull();
  });

  test('reconoce el documento en la pregunta', () => {
    expect(tipoDesdePregunta('¿cuándo vence mi soat?')).toBe('SOAT');
    expect(tipoDesdePregunta('cuando vence mi licencia de conducir')).toBe('Brevete');
    expect(tipoDesdePregunta('mi revisión técnica está vigente')).toBe('Revisión técnica');
    expect(tipoDesdePregunta('¿cuándo vence mi seguro de salud?')).toBe('Seguro de salud');
  });

  test('"¿cuándo vence mi SOAT?" se responde sin IA', () => {
    const r = fastAnswer('¿Cuándo vence mi SOAT?', DOCS, HOY)!;
    expect(r.texto).toBe('Tu SOAT vence el 15 de marzo de 2027, en 142 días.');
    expect(r.fuentes.map((d) => d.id)).toEqual([1]);
  });

  test('vigente / vencido', () => {
    expect(fastAnswer('¿mi soat está vigente?', DOCS, HOY)!.texto).toStartWith('Sí, tu SOAT está vigente');
    expect(fastAnswer('¿cuándo vence mi brevete?', DOCS, HOY)!.texto).toStartWith('No tengo tu Brevete guardado');
  });

  test('qué vence pronto', () => {
    const r = fastAnswer('¿qué se vence pronto?', DOCS, HOY)!;
    expect(r.fuentes.map((d) => d.id)).toEqual([3]);
    expect(r.texto).toContain('venció el 20 de octubre de 2026 (hace 4 días)');
  });

  test('preguntas abiertas van a la IA', () => {
    expect(fastAnswer('¿cuánto pago de alquiler?', DOCS, HOY)).toBeNull();
  });

  test('búsqueda sin palabras vacías y con sinónimos', () => {
    expect(toFtsQuery('¿cuánto pago de alquiler?')).toBe('"pago"* OR "alquiler"* OR "arrendamiento"* OR "merced"*');
  });

  test('a la IA le mando solo los trozos relevantes', () => {
    const largo = `${'relleno sin importancia\n'.repeat(80)}CLAUSULA TERCERA: La merced conductiva es de S/ 1,200.00\n${'más relleno\n'.repeat(80)}`;
    const p = pasajes(largo, '¿cuánto pago de alquiler?', 300);
    expect(p).toContain('merced conductiva es de S/ 1,200.00');
    expect(p.length).toBeLessThanOrEqual(300);
  });
});

describe('voz', () => {
  test('corrige lo que el dictado entiende mal', () => {
    expect(fixDictation('cuándo vence mi so at')).toBe('cuándo vence mi SOAT');
    expect(fixDictation('hasta cuándo es mi d n i')).toBe('hasta cuándo es mi DNI');
  });

  test('lee fechas y montos como una persona', () => {
    expect(textoParaVoz('Vence el 2027-03-15. Fuente: [1] SOAT')).toBe('Vence el 15 de marzo de 2027.');
    expect(textoParaVoz('La merced es **S/ 1,200.00** [1]')).toBe('La merced es 1200 soles');
    expect(textoParaVoz('Precio S/ 95.50')).toBe('Precio 95 soles con 50 céntimos');
    expect(textoParaVoz('Póliza ···3921')).toBe('Póliza que termina en 3 9 2 1');
  });
});
