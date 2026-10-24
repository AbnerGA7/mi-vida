import * as SecureStore from 'expo-secure-store';

import type { LocalModelId } from '@/lib/config';

// Preferencias de la IA guardadas en el celular (no son secretas, pero SecureStore ya está a mano).
export type AiPrefs = {
  // true: finanzas y documentos solo con la IA local (más privado, más lento).
  // false: con internet usan Gemini (mucho más rápido); sin internet, la local.
  privacidadEstricta: boolean;
  modeloLocal: LocalModelId;
};

const KEY = 'ai_prefs_v1';
const DEFAULTS: AiPrefs = { privacidadEstricta: true, modeloLocal: 'rapida' };

let cache: AiPrefs | null = null;
const listeners = new Set<(p: AiPrefs) => void>();

export async function getAiPrefs(): Promise<AiPrefs> {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache!;
}

export async function setAiPrefs(patch: Partial<AiPrefs>) {
  const next = { ...(await getAiPrefs()), ...patch };
  cache = next;
  await SecureStore.setItemAsync(KEY, JSON.stringify(next)).catch(() => {});
  listeners.forEach((l) => l(next));
  return next;
}

export function onAiPrefsChange(l: (p: AiPrefs) => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
