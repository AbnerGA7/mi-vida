import { completeCloud, hasCloudKey } from '@/lib/ai/cloud';
import { completeLocal, isLocalModelReady } from '@/lib/ai/local';
import { isOnline } from '@/lib/ai/net';
import { getAiPrefs } from '@/lib/ai/prefs';
import { AiCancelled, type AiOptions, type AiSource, type ChatMessage } from '@/lib/ai/types';

export { AiCancelled } from '@/lib/ai/types';
export { friendlyError, parseJson, parseJsonLoose } from '@/lib/ai/text';
export { prewarmLocal, warmUpLocal } from '@/lib/ai/local';
export type { AiOptions, AiSource, ChatMessage } from '@/lib/ai/types';

export type AiRoute = { source: AiSource; motivo: string } | { source: null; motivo: string };

// Decide dónde respondo sin generar nada (sirve para mostrar "IA nube/local" antes de empezar).
export async function planRoute(privado = false): Promise<AiRoute> {
  const [online, prefs, localReady] = await Promise.all([isOnline(), getAiPrefs(), isLocalModelReady()]);
  const nubePermitida = !privado || !prefs.privacidadEstricta;
  if (online && nubePermitida && hasCloudKey()) return { source: 'nube', motivo: 'rápida en la nube' };
  if (localReady) {
    return { source: 'local', motivo: !online ? 'sin internet' : privado ? 'dato privado' : 'sin clave de nube' };
  }
  if (!online) return { source: null, motivo: 'Sin internet y sin IA local. Descárgala en Ajustes.' };
  if (!hasCloudKey()) return { source: null, motivo: 'Falta la clave de Gemini en el .env y no hay IA local.' };
  return { source: null, motivo: 'Este dato es privado: descarga la IA local en Ajustes o desactiva la privacidad estricta.' };
}

// Modo híbrido:
// 1. Nube si hay internet y (el dato no es privado o la privacidad estricta está apagada).
// 2. Si la nube falla o tarda, caigo a la local sin que tenga que hacer nada.
export async function askAi(messages: ChatMessage[], opts: AiOptions = {}): Promise<{ text: string; source: AiSource }> {
  const { privado = false, maxTokens, rapido, json, jsonSchema, temperature, onPartial, signal } = opts;
  const route = await planRoute(privado);
  if (signal?.aborted) throw new AiCancelled();

  if (route.source === 'nube') {
    try {
      const text = await completeCloud(messages, {
        maxTokens,
        rapido,
        json,
        temperature,
        signal,
        onPartial: onPartial && ((t) => onPartial(t, 'nube')),
      });
      if (text) return { text, source: 'nube' };
    } catch (e) {
      if (e instanceof AiCancelled) throw e;
      // sigo con la local
    }
  }

  if (!(await isLocalModelReady())) {
    throw new Error(route.source === null ? route.motivo : 'La nube no respondió y no tienes la IA local. Descárgala en Ajustes.');
  }
  onPartial?.('', 'local');
  const text = await completeLocal(messages, {
    maxTokens,
    temperature,
    json,
    jsonSchema,
    signal,
    onPartial: onPartial && ((t) => onPartial(t, 'local')),
  });
  return { text, source: 'local' };
}
