// Utilidades de texto de la IA sin módulos nativos, para poder probarlas con bun test.
import { AiCancelled } from '@/lib/ai/types';

// Saca el primer objeto JSON de una respuesta (los modelos chicos a veces agregan texto alrededor).
export function parseJsonLoose<T = any>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('La IA no devolvió JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// Alias corto que usa Cerebro.
export const parseJson = parseJsonLoose;

export function friendlyError(e: unknown) {
  if (e instanceof AiCancelled) return 'Cancelado';
  const msg = e instanceof Error ? e.message : String(e);
  if (/Network request failed|network/i.test(msg)) return 'Sin conexión. Intenta de nuevo o usa la IA local.';
  return msg;
}
