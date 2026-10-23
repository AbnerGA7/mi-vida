import NetInfo from '@react-native-community/netinfo';

import { completeCloud, hasCloudKey } from '@/lib/ai/cloud';
import { completeLocal, isLocalModelReady } from '@/lib/ai/local';
import type { AiOptions, AiSource, ChatMessage } from '@/lib/ai/types';

export type { AiSource, ChatMessage } from '@/lib/ai/types';

// Modo híbrido: nube si hay internet y el dato no es privado; si no, IA local.
// Si la nube falla (sin cuota, sin señal), caigo a la local sin que el usuario lo note.
export async function askAi(
  messages: ChatMessage[],
  { privado = false, maxTokens }: AiOptions = {},
): Promise<{ text: string; source: AiSource }> {
  const net = await NetInfo.fetch();
  const online = Boolean(net.isConnected && net.isInternetReachable !== false);

  if (online && !privado && hasCloudKey()) {
    try {
      return { text: await completeCloud(messages, maxTokens), source: 'nube' };
    } catch {
      // sigo con la local
    }
  }

  if (!(await isLocalModelReady())) {
    throw new Error('Descarga la IA local en Ajustes para usarla sin internet.');
  }
  return { text: await completeLocal(messages, maxTokens), source: 'local' };
}
