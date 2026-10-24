import NetInfo from '@react-native-community/netinfo';

import { completeCloud, hasCloudKey } from '@/lib/ai/cloud';
import { completeLocal, isLocalModelReady } from '@/lib/ai/local';
import type { AiOptions, AiSource, ChatMessage } from '@/lib/ai/types';

export { prewarmLocal } from '@/lib/ai/local';
export type { AiSource, ChatMessage } from '@/lib/ai/types';

// Modo híbrido: nube si hay internet y el dato no es privado; si no, IA local.
// Si la nube falla (sin cuota, sin señal), caigo a la local sin que el usuario lo note.
export async function askAi(
  messages: ChatMessage[],
  options: AiOptions = {},
): Promise<{ text: string; source: AiSource }> {
  // Lo privado ni siquiera consulta la red: va directo a la local y me ahorro esa espera.
  const net = options.privado || !hasCloudKey() ? null : await NetInfo.fetch();
  const online = Boolean(net?.isConnected && net.isInternetReachable !== false);

  if (online) {
    try {
      return { text: await completeCloud(messages, options), source: 'nube' };
    } catch {
      // sigo con la local
    }
  }

  if (!(await isLocalModelReady())) {
    throw new Error('Descarga la IA local en Ajustes para usarla sin internet.');
  }
  return { text: await completeLocal(messages, options), source: 'local' };
}
