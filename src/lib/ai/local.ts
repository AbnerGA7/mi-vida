import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';

import { LOCAL_MODEL } from '@/lib/config';
import type { ChatMessage } from '@/lib/ai/types';

const modelPath = `${FileSystem.documentDirectory}${LOCAL_MODEL.file}`;
let contextPromise: Promise<LlamaContext> | null = null;

export async function isLocalModelReady() {
  return (await FileSystem.getInfoAsync(modelPath)).exists;
}

// Descarga el modelo una sola vez (~2 GB). Conviene hacerlo con Wi-Fi.
export async function downloadLocalModel(onProgress?: (fraction: number) => void) {
  const download = FileSystem.createDownloadResumable(LOCAL_MODEL.url, modelPath, {}, (p) =>
    onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite),
  );
  await download.downloadAsync();
}

function getContext() {
  contextPromise ??= initLlama({
    model: modelPath,
    n_ctx: 4096,
    // Mando capas a la GPU del celular cuando se puede.
    n_gpu_layers: 99,
  });
  return contextPromise;
}

export async function completeLocal(messages: ChatMessage[], maxTokens = 512) {
  const ctx = await getContext();
  const result = await ctx.completion({ messages, n_predict: maxTokens, temperature: 0.3 });
  return result.text.trim();
}
