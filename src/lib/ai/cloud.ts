import { fetch as expoFetch } from 'expo/fetch';

import { AiCancelled, type ChatMessage } from '@/lib/ai/types';
import { CLOUD_FIRST_BYTE_MS, CLOUD_TOTAL_MS, GEMINI_API_KEY, GEMINI_FAST_MODEL, GEMINI_MODEL } from '@/lib/config';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function hasCloudKey() {
  return GEMINI_API_KEY.length > 0;
}

// Gemini "piensa" antes de responder y eso suma segundos. Pido el mínimo de pensamiento que acepte
// cada modelo y recuerdo cuál funcionó para no volver a fallar en la siguiente pregunta.
type Thinking = { thinkingLevel: string } | { thinkingBudget: number } | null;
const THINKING_TRIES: Thinking[] = [{ thinkingLevel: 'minimal' }, { thinkingLevel: 'low' }, { thinkingBudget: 0 }, null];
const thinkingOk = new Map<string, number>();
// Si el modelo ligero no existe para mi clave, uso el principal.
let fastModelBroken = false;

type CloudOptions = {
  maxTokens?: number;
  temperature?: number;
  rapido?: boolean;
  json?: boolean;
  signal?: AbortSignal;
  onPartial?: (texto: string) => void;
};

class HttpError extends Error {
  constructor(
    public status: number,
    body: string,
  ) {
    super(`Gemini respondió ${status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }
}

function toGemini(messages: ChatMessage[]) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  return { system, contents };
}

// Une la señal del usuario (botón Detener) con los tiempos límite.
function linkedController(user?: AbortSignal) {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (user) {
    if (user.aborted) ctrl.abort();
    else user.addEventListener('abort', onAbort);
  }
  return { ctrl, cleanup: () => user?.removeEventListener('abort', onAbort) };
}

function decoder() {
  if (typeof TextDecoder !== 'undefined') {
    const td = new TextDecoder('utf-8');
    return (chunk: Uint8Array) => td.decode(chunk, { stream: true });
  }
  // Respaldo UTF-8 mínimo por si el runtime no trae TextDecoder.
  let pending: number[] = [];
  return (chunk: Uint8Array) => {
    const bytes = [...pending, ...chunk];
    pending = [];
    let out = '';
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i];
      const len = b < 0x80 ? 1 : b >= 0xf0 ? 4 : b >= 0xe0 ? 3 : 2;
      if (i + len > bytes.length) {
        pending = bytes.slice(i);
        break;
      }
      let cp = len === 1 ? b : b & (0xff >> (len + 1));
      for (let k = 1; k < len; k++) cp = (cp << 6) | (bytes[i + k] & 0x3f);
      out += String.fromCodePoint(cp);
      i += len;
    }
    return out;
  };
}

function textOf(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  // Ignoro las partes de "pensamiento" si el modelo las devuelve.
  return parts
    .filter((p: any) => !p.thought)
    .map((p: any) => p.text ?? '')
    .join('');
}

async function streamOnce(model: string, messages: ChatMessage[], opts: CloudOptions, thinking: Thinking) {
  const { system, contents } = toGemini(messages);
  const { ctrl, cleanup } = linkedController(opts.signal);
  let firstByte = false;
  let timedOut = false;
  const firstTimer = setTimeout(() => {
    if (!firstByte) {
      timedOut = true;
      ctrl.abort();
    }
  }, CLOUD_FIRST_BYTE_MS);
  const totalTimer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, CLOUD_TOTAL_MS);

  try {
    const res = await expoFetch(`${BASE}/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      signal: ctrl.signal,
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? (opts.rapido || opts.json ? 0.1 : 0.4),
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
          ...(thinking ? { thinkingConfig: thinking } : {}),
        },
      }),
    });
    if (!res.ok) throw new HttpError(res.status, await res.text().catch(() => ''));

    let full = '';
    const body = res.body;
    if (!body) {
      // Sin stream disponible: leo todo junto.
      const raw = await res.text();
      for (const line of raw.split('\n')) {
        if (line.startsWith('data:')) full += textOf(JSON.parse(line.slice(5)));
      }
      firstByte = true;
      opts.onPartial?.(full);
      return full.trim();
    }

    const reader = body.getReader();
    const decode = decoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      firstByte = true;
      buffer += decode(value);
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        try {
          const piece = textOf(JSON.parse(line.slice(5)));
          if (piece) {
            full += piece;
            opts.onPartial?.(full);
          }
        } catch {
          // línea incompleta: la ignoro
        }
      }
    }
    return full.trim();
  } catch (e) {
    if (opts.signal?.aborted) throw new AiCancelled();
    if (timedOut) throw new Error('La nube tardó demasiado');
    throw e;
  } finally {
    clearTimeout(firstTimer);
    clearTimeout(totalTimer);
    cleanup();
  }
}

async function withThinkingFallback(model: string, messages: ChatMessage[], opts: CloudOptions) {
  const start = thinkingOk.get(model) ?? 0;
  let lastError: unknown;
  for (let i = start; i < THINKING_TRIES.length; i++) {
    try {
      const text = await streamOnce(model, messages, opts, THINKING_TRIES[i]);
      thinkingOk.set(model, i);
      return text;
    } catch (e) {
      lastError = e;
      // 400 = el modelo no acepta ese nivel de pensamiento → pruebo el siguiente.
      if (e instanceof HttpError && e.status === 400) continue;
      throw e;
    }
  }
  throw lastError;
}

export async function completeCloud(messages: ChatMessage[], opts: CloudOptions = {}) {
  const useFast = opts.rapido && !fastModelBroken && GEMINI_FAST_MODEL !== GEMINI_MODEL;
  const model = useFast ? GEMINI_FAST_MODEL : GEMINI_MODEL;
  try {
    return await withThinkingFallback(model, messages, opts);
  } catch (e) {
    if (e instanceof AiCancelled) throw e;
    // Modelo ligero no disponible (404) o saturado (429/503): pruebo una vez con el principal.
    if (useFast && e instanceof HttpError && [404, 429, 503].includes(e.status)) {
      if (e.status === 404) fastModelBroken = true;
      return withThinkingFallback(GEMINI_MODEL, messages, opts);
    }
    // Saturado: un reintento corto con el mismo modelo.
    if (e instanceof HttpError && (e.status === 429 || e.status === 503)) {
      await new Promise((r) => setTimeout(r, 800));
      return withThinkingFallback(model, messages, opts);
    }
    throw e;
  }
}

// Solo se usa si el OCR local no pudo leer un PDF y yo acepto enviarlo a la nube.
export async function extractPdfTextCloud(pdfBase64: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await expoFetch(`${BASE}/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      signal: ctrl.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: pdfBase64 } },
              { text: 'Transcribe todo el texto de este documento tal cual, sin resumir ni comentar.' },
            ],
          },
        ],
        generationConfig: { maxOutputTokens: 4096, temperature: 0 },
      }),
    });
    if (!res.ok) throw new HttpError(res.status, await res.text().catch(() => ''));
    return textOf(await res.json()).trim();
  } catch (e) {
    if (ctrl.signal.aborted) throw new Error('La nube tardó demasiado leyendo el PDF');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
