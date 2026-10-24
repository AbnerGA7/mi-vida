// Pruebas de cómo leo las respuestas de la IA. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { friendlyError, parseJsonLoose } from '@/lib/ai/text';
import { AiCancelled } from '@/lib/ai/types';

describe('JSON de la IA', () => {
  test('lee JSON limpio y dentro de bloques de código', () => {
    expect(parseJsonLoose('{"monto": 25}')).toEqual({ monto: 25 });
    expect(parseJsonLoose('```json\n{"monto": 25}\n```')).toEqual({ monto: 25 });
  });

  test('ignora el texto que el modelo agrega alrededor', () => {
    expect(parseJsonLoose('Claro, aquí está: {"tipo": "gasto"} ¡Listo!')).toEqual({ tipo: 'gasto' });
  });

  test('si el modelo repite el objeto, me quedo con el primero', () => {
    expect(parseJsonLoose('{"a": 1}\n{"a": 2}')).toEqual({ a: 1 });
  });

  test('respeta llaves dentro de los textos', () => {
    expect(parseJsonLoose('{"descripcion": "menú {especial}", "monto": 15} gracias')).toEqual({ descripcion: 'menú {especial}', monto: 15 });
  });

  test('tolera la coma colgante antes de cerrar', () => {
    expect(parseJsonLoose('{"monto": 25, "tipo": "gasto",}')).toEqual({ monto: 25, tipo: 'gasto' });
  });

  test('salta llaves sueltas antes del JSON de verdad', () => {
    expect(parseJsonLoose('Uso {formato}: {"ok": true}')).toEqual({ ok: true });
  });

  test('sin JSON avisa con un error claro', () => {
    expect(() => parseJsonLoose('no sé')).toThrow('La IA no devolvió JSON');
  });
});

describe('mensajes de error', () => {
  test('cancelar no es un error para mostrar', () => {
    expect(friendlyError(new AiCancelled())).toBe('Cancelado');
  });

  test('sin red sugiere la IA local', () => {
    expect(friendlyError(new Error('Network request failed'))).toContain('Sin conexión');
  });
});
