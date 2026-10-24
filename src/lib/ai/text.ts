// Utilidades de texto de la IA sin módulos nativos, para poder probarlas con bun test.
import { AiCancelled } from '@/lib/ai/types';

// Busca dónde cierra el objeto que abre en `start`, respetando llaves dentro de textos.
function closingBrace(text: string, start: number) {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === '\\') i++;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return i;
  }
  return -1;
}

// Saca el primer objeto JSON de una respuesta (los modelos chicos a veces agregan texto alrededor,
// repiten el objeto o dejan una coma colgando antes de cerrar).
export function parseJsonLoose<T = any>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, '');
  for (let start = cleaned.indexOf('{'); start >= 0; start = cleaned.indexOf('{', start + 1)) {
    const end = closingBrace(cleaned, start);
    if (end < 0) break;
    const raw = cleaned.slice(start, end + 1);
    for (const candidate of [raw, raw.replace(/,\s*([}\]])/g, '$1')]) {
      try {
        return JSON.parse(candidate);
      } catch {
        // pruebo la versión sin comas colgantes o el siguiente objeto
      }
    }
  }
  throw new Error('La IA no devolvió JSON');
}

// Alias corto que usa Cerebro.
export const parseJson = parseJsonLoose;

export function friendlyError(e: unknown) {
  if (e instanceof AiCancelled) return 'Cancelado';
  const msg = e instanceof Error ? e.message : String(e);
  if (/Network request failed|network/i.test(msg)) return 'Sin conexión. Intenta de nuevo o usa la IA local.';
  return msg;
}
