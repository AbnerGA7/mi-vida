import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';

import { LOCAL_MODEL } from '@/lib/config';
import type { AiOptions, ChatMessage } from '@/lib/ai/types';

const modelPath = `${FileSystem.documentDirectory}${LOCAL_MODEL.file}`;
let contextPromise: Promise<LlamaContext> | null = null;
// El contexto de llama atiende una respuesta a la vez: encolo las demás en vez de chocarlas.
let queue: Promise<unknown> = Promise.resolve();
// Una vez que vi el archivo no vuelvo a tocar el disco en cada pregunta.
let modelReady = false;

export async function isLocalModelReady() {
  if (modelReady) return true;
  modelReady = (await FileSystem.getInfoAsync(modelPath)).exists;
  return modelReady;
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
  modelReady = true;
}

export async function deleteLocalModel() {
  // Espero que termine la respuesta en curso antes de soltar el modelo.
  await queue;
  if (contextPromise) {
    await (await contextPromise).release();
    contextPromise = null;
  }
  modelReady = false;
  await FileSystem.deleteAsync(modelPath, { idempotent: true });
}

function getContext() {
  contextPromise ??= initLlama({
    model: modelPath,
    n_ctx: 4096,
    n_batch: 512,
    // Mando capas a la GPU del celular cuando se puede.
    n_gpu_layers: 99,
    // Mantengo el modelo en RAM mapeado: la segunda pregunta ya no vuelve a leerlo del disco.
    use_mmap: true,
    flash_attn_type: 'auto',
  }).catch((e) => {
    // Si falló al cargar, la próxima vez lo intento de nuevo en vez de quedarme con el error.
    contextPromise = null;
    throw e;
  });
  return contextPromise;
}

// Cargar el modelo tarda unos segundos: lo hago apenas abro una pantalla que lo va a usar,
// así la primera pregunta responde rápido.
export async function prewarmLocal() {
  if (await isLocalModelReady()) await getContext().catch(() => {});
}

// Qwen a veces sigue escribiendo otro turno; corto en sus marcas de fin.
const STOP = ['<|im_end|>', '<|endoftext|>', '<|im_start|>'];

export function completeLocal(messages: ChatMessage[], { maxTokens = 512, temperature = 0.3, json }: AiOptions = {}) {
  const run = queue.then(async () => {
    const ctx = await getContext();
    const result = await ctx.completion({
      messages,
      n_predict: maxTokens,
      temperature,
      top_p: 0.9,
      // Qwen 2.5 repite frases si no lo freno un poco.
      penalty_repeat: 1.1,
      stop: STOP,
      ...(json ? { response_format: { type: 'json_schema' as const, json_schema: { strict: true, schema: json } } } : {}),
    });
    return result.text.trim();
  });
  queue = run.catch(() => {});
  return run;
}
