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
  // Gemini devuelve el código HTTP con su JSON en inglés: lo traduzco a algo que pueda hacer.
  const status = Number(msg.match(/Gemini respondió (\d{3})/)?.[1]);
  if (status === 429) return 'Gemini llegó a su límite gratis por ahora. Espera un minuto o usa la IA local.';
  if (status === 400 || status === 401 || status === 403) return 'Gemini rechazó la clave. Revisa EXPO_PUBLIC_GEMINI_API_KEY en el .env.';
  if (status >= 500) return 'Gemini está caído en este momento. Intenta en un rato o usa la IA local.';
  if (/tard[óo] demasiado|timeout/i.test(msg)) return 'La IA tardó demasiado. Intenta con una pregunta más corta.';
  return msg;
}
