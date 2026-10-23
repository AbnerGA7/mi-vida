import { GEMINI_API_KEY, GEMINI_MODEL } from '@/lib/config';
import type { ChatMessage } from '@/lib/ai/types';

export function hasCloudKey() {
  return GEMINI_API_KEY.length > 0;
}

export async function completeCloud(messages: ChatMessage[], maxTokens = 1024) {
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
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.3 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const data = await res.json();
  return String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}
