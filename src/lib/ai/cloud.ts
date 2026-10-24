import { GEMINI_API_KEY, GEMINI_MODEL } from '@/lib/config';
import type { AiOptions, ChatMessage } from '@/lib/ai/types';

// Con señal mala prefiero caer rápido a la IA local que dejar la pantalla esperando.
const CLOUD_TIMEOUT_MS = 25000;

export function hasCloudKey() {
  return GEMINI_API_KEY.length > 0;
}

// Solo se usa si el OCR local no pudo leer un PDF y yo acepto enviarlo a la nube.
export async function extractPdfTextCloud(pdfBase64: string) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
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
    },
  );
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const data = await res.json();
  return String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

export async function completeCloud(messages: ChatMessage[], { maxTokens = 1024, temperature = 0.3, json }: AiOptions = {}) {
  const system = messages.find((m) => m.role === 'system');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system.content }] } : undefined,
        contents,
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
    },
  );
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const data = await res.json();
  return String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}
