import * as FileSystem from 'expo-file-system/legacy';
import { initLlama, type LlamaContext } from 'llama.rn';

import { getAiPrefs } from '@/lib/ai/prefs';
import { AiCancelled, type ChatMessage } from '@/lib/ai/types';
import { LOCAL_MODELS, type LocalModelId, type LocalModelInfo } from '@/lib/config';

const pathOf = (m: LocalModelInfo) => `${FileSystem.documentDirectory}${m.file}`;

// ---------- Qué modelo uso ----------

async function exists(m: LocalModelInfo) {
  try {
    return (await FileSystem.getInfoAsync(pathOf(m))).exists;
  } catch {
    return false;
  }
}

export async function downloadedModels(): Promise<LocalModelId[]> {
  const ids = Object.keys(LOCAL_MODELS) as LocalModelId[];
  const flags = await Promise.all(ids.map((id) => exists(LOCAL_MODELS[id])));
  return ids.filter((_, i) => flags[i]);
}

// El elegido en Ajustes si está descargado; si no, cualquiera que esté descargado.
async function activeModel(): Promise<LocalModelInfo | null> {
  const { modeloLocal } = await getAiPrefs();
  const have = await downloadedModels();
  if (have.includes(modeloLocal)) return LOCAL_MODELS[modeloLocal];
  return have[0] ? LOCAL_MODELS[have[0]] : null;
}

export async function isLocalModelReady() {
  return (await activeModel()) !== null;
}

export async function activeLocalModelName() {
  return (await activeModel())?.name ?? null;
}

export async function hasSpaceForModel(id: LocalModelId = 'rapida') {
  try {
    return (await FileSystem.getFreeDiskStorageAsync()) > LOCAL_MODELS[id].bytes * 1.2;
  } catch {
    return true;
  }
}

// ---------- Descarga (reanudable) ----------

let currentDownload: FileSystem.DownloadResumable | null = null;

// Bajo a un archivo temporal y lo muevo al final: una descarga cortada nunca pasa por modelo listo.
export async function downloadLocalModel(id: LocalModelId, onProgress?: (fraction: number) => void) {
  const model = LOCAL_MODELS[id];
  const target = pathOf(model);
  const tempPath = `${target}.part`;
  currentDownload = FileSystem.createDownloadResumable(model.url, tempPath, {}, (p) => {
    if (p.totalBytesExpectedToWrite > 0) onProgress?.(p.totalBytesWritten / p.totalBytesExpectedToWrite);
  });
  try {
    const result = await currentDownload.downloadAsync();
    if (!result) throw new AiCancelled();
    if (result.status !== 200) throw new Error(`La descarga falló (${result.status})`);
    // Un archivo diminuto es una página de error, no un modelo.
    const info = await FileSystem.getInfoAsync(tempPath);
    if (!info.exists || (info.size ?? 0) < model.bytes * 0.5) throw new Error('El archivo descargado está incompleto');
    await FileSystem.moveAsync({ from: tempPath, to: target });
  } catch (e) {
    await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
    throw e;
  } finally {
    currentDownload = null;
  }
}

export async function cancelDownload() {
  await currentDownload?.pauseAsync().catch(() => {});
  currentDownload = null;
}

export async function deleteLocalModel(id: LocalModelId) {
  if (loaded?.id === id) await releaseLocal();
  await FileSystem.deleteAsync(pathOf(LOCAL_MODELS[id]), { idempotent: true });
}

// ---------- Contexto (carga en memoria) ----------

let loaded: { id: LocalModelId; ctx: LlamaContext } | null = null;
let loading: Promise<{ id: LocalModelId; ctx: LlamaContext }> | null = null;
let loadProgress = 0;
const statusListeners = new Set<() => void>();
const notify = () => statusListeners.forEach((l) => l());

export type LocalStatus = 'sin-modelo' | 'dormida' | 'cargando' | 'lista' | 'pensando';

export function localStatus(): { status: LocalStatus; progress: number } {
  if (busy) return { status: 'pensando', progress: 1 };
  if (loaded) return { status: 'lista', progress: 1 };
  if (loading) return { status: 'cargando', progress: loadProgress };
  return { status: 'dormida', progress: 0 };
}

export function onLocalStatusChange(l: () => void) {
  statusListeners.add(l);
  return () => {
    statusListeners.delete(l);
  };
}

async function load(model: LocalModelInfo) {
  const params = {
    model: pathOf(model),
    // 2048 de contexto alcanza para mis preguntas y carga mucho más rápido que 4096.
    n_ctx: 2048,
    n_batch: 512,
    // Un solo usuario: una sola secuencia, menos memoria.
    n_parallel: 1,
    n_threads: 4,
    use_mmap: true,
    use_mlock: false,
    n_gpu_layers: 99,
  };
  try {
    return await initLlama(params, (p) => {
      loadProgress = p / 100;
      notify();
    });
  } catch {
    // Algunos celulares fallan con la GPU: reintento solo con CPU.
    return initLlama({ ...params, n_gpu_layers: 0, n_threads: 4 });
  }
}

async function getContext() {
  const model = await activeModel();
  if (!model) throw new Error('Descarga la IA local en Ajustes para usarla sin internet.');
  if (loaded?.id === model.id) return loaded.ctx;
  if (loaded) await releaseLocal();
  if (!loading) {
    loadProgress = 0;
    loading = load(model)
      .then((ctx) => {
        loaded = { id: model.id, ctx };
        return loaded;
      })
      .finally(() => {
        // Si falló, el próximo intento vuelve a cargar (antes quedaba roto hasta reiniciar la app).
        loading = null;
        notify();
      });
    notify();
  }
  return (await loading).ctx;
}

export async function releaseLocal() {
  const l = loaded;
  loaded = null;
  notify();
  if (l) await l.ctx.release().catch(() => {});
}

// Precarga en segundo plano para que la primera pregunta no espere a cargar 1-2 GB.
export async function warmUpLocal() {
  try {
    if (loaded || loading || !(await isLocalModelReady())) return;
    await getContext();
  } catch {
    // no pasa nada: se intentará al usarla
  }
}

// ---------- Cola: una generación a la vez (dos a la vez hacían caer a llama.rn) ----------

let queue: Promise<unknown> = Promise.resolve();
let busy = false;

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

type LocalOptions = {
  maxTokens?: number;
  temperature?: number;
  json?: boolean;
  jsonSchema?: object;
  signal?: AbortSignal;
  onPartial?: (texto: string) => void;
};

export function completeLocal(messages: ChatMessage[], opts: LocalOptions = {}) {
  return enqueue(async () => {
    if (opts.signal?.aborted) throw new AiCancelled();
    const ctx = await getContext();
    if (opts.signal?.aborted) throw new AiCancelled();

    const onAbort = () => {
      ctx.stopCompletion().catch(() => {});
    };
    opts.signal?.addEventListener('abort', onAbort);
    busy = true;
    notify();
    let full = '';
    try {
      const result = await ctx.completion(
        {
          messages,
          n_predict: opts.maxTokens ?? 512,
          temperature: opts.temperature ?? (opts.json ? 0.1 : 0.3),
          top_p: 0.9,
          // Evita que repita frases (pasa mucho con modelos chicos).
          penalty_repeat: 1.1,
          ...(opts.json
            ? {
                response_format: opts.jsonSchema
                  ? { type: 'json_schema' as const, json_schema: { strict: true, schema: opts.jsonSchema } }
                  : { type: 'json_object' as const },
              }
            : {}),
        },
        (data) => {
          if (!opts.onPartial) return;
          full = data.accumulated_text ?? full + data.token;
          opts.onPartial(full);
        },
      );
      if (opts.signal?.aborted) throw new AiCancelled();
      return (result.text || full).trim();
    } finally {
      busy = false;
      opts.signal?.removeEventListener('abort', onAbort);
      notify();
    }
  });
}
