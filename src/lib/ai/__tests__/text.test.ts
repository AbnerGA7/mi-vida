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
