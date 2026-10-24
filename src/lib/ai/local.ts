import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';

import { LOCAL_MODEL } from '@/lib/config';
import type { AiOptions, ChatMessage } from '@/lib/ai/types';

const modelPath = `${FileSystem.documentDirectory}${LOCAL_MODEL.file}`;
let contextPromise: Promise<LlamaContext> | null = null;

export async function isLocalModelReady() {
  return (await FileSystem.getInfoAsync(modelPath)).exists;
}

const MODEL_BYTES = 2.1e9;

export async function hasSpaceForModel() {
  return (await FileSystem.getFreeDiskStorageAsync()) > MODEL_BYTES * 1.2;
}

// Descarga el modelo una sola vez (~2 GB). Conviene hacerlo con Wi-Fi.
// Bajo a un archivo temporal y lo muevo al final: una descarga cortada nunca pasa por modelo listo.
export async function downloadLocalModel(onProgress?: (fraction: number) => void) {
  const tempPath = `${modelPath}.part`;
  const download = FileSystem.createDownloadResumable(LOCAL_MODEL.url, tempPath, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  const result = await download.downloadAsync();
  if (!result || result.status !== 200) {
    await FileSystem.deleteAsync(tempPath, { idempotent: true });
    throw new Error(`La descarga falló (${result?.status ?? 'sin respuesta'})`);
  }
  await FileSystem.moveAsync({ from: tempPath, to: modelPath });
}

export async function deleteLocalModel() {
  if (contextPromise) {
    await (await contextPromise).release();
    contextPromise = null;
  }
  await FileSystem.deleteAsync(modelPath, { idempotent: true });
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

export async function completeLocal(messages: ChatMessage[], { maxTokens = 512, temperature = 0.3, json }: AiOptions = {}) {
  const ctx = await getContext();
  const result = await ctx.completion({
    messages,
    n_predict: maxTokens,
    temperature,
    ...(json ? { response_format: { type: 'json_schema' as const, json_schema: { strict: true, schema: json } } } : {}),
  });
  return result.text.trim();
}
