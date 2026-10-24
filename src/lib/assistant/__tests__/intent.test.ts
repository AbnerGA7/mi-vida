// Pruebas de cómo el asistente decide qué hacer con lo que le escribo. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { esRegistroDePlata, RE_DOCS, RE_PLATA, sinTildes, sinVerboDeGasto, textoDeTarea } from '@/lib/assistant/intent';

describe('registro de plata desde el chat', () => {
  test('reconoce gastos e ingresos dichos con verbo', () => {
    expect(esRegistroDePlata('Gasté 25 en menú')).toBe(true);
    expect(esRegistroDePlata('me pagaron 1200')).toBe(true);
  });

  test('reconoce el formato corto si conozco la categoría', () => {
    expect(esRegistroDePlata('15 taxi con yape')).toBe(true);
    expect(esRegistroDePlata('15 cosas raras')).toBe(false);
  });

  test('una pregunta con números no es un registro', () => {
    expect(esRegistroDePlata('20 taxi es mucho?')).toBe(false);
    expect(esRegistroDePlata('¿cuánto gasté en comida?')).toBe(false);
  });

  test('quita el verbo antes de registrar', () => {
    expect(sinVerboDeGasto('gasté 25 en menú')).toBe('25 en menú');
    expect(sinVerboDeGasto('Pagué 40 de luz')).toBe('40 de luz');
  });
});

describe('tareas desde el chat', () => {
  test('saca el texto de la tarea sin la frase inicial', () => {
    expect(textoDeTarea('Recuérdame pagar la luz el viernes!')).toBe('pagar la luz el viernes!');
    expect(textoDeTarea('tarea: llamar al banco')).toBe('llamar al banco');
    expect(textoDeTarea('tengo que renovar el DNI')).toBe('renovar el DNI');
  });

  test('si no empieza como tarea no la crea', () => {
    expect(textoDeTarea('¿qué tengo para hoy?')).toBeNull();
  });
});

describe('temas de la pregunta', () => {
  test('detecta documentos y plata sin tildes', () => {
    expect(RE_DOCS.test(sinTildes('¿Cuándo vence mi SOAT?'))).toBe(true);
    expect(RE_PLATA.test(sinTildes('¿Cómo voy con mi plata?'))).toBe(true);
    expect(RE_PLATA.test(sinTildes('¿Qué entreno hoy?'))).toBe(false);
  });
});
