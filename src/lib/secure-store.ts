import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import type { GoogleUser } from '@/lib/auth/google';

const USER_KEY = 'user';
const DB_KEY = 'db_key';

// Solo accesible con el celular desbloqueado y nunca se copia a otro dispositivo.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function saveUser(user: GoogleUser) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user), options);
}

export async function loadUser(): Promise<GoogleUser | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY, options);
  return raw ? (JSON.parse(raw) as GoogleUser) : null;
}

export async function clearUser() {
  await SecureStore.deleteItemAsync(USER_KEY, options);
  await SecureStore.deleteItemAsync(GOOGLE_TOKEN_KEY, options);
}

// Token de Google (dura ~1 hora): lo guardo para no pedir reconectar cada vez que abro la app.
const GOOGLE_TOKEN_KEY = 'google_token';

export async function saveGoogleToken(token: string, expiresInSeconds = 3600) {
  const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000;
  await SecureStore.setItemAsync(GOOGLE_TOKEN_KEY, JSON.stringify({ token, expiresAt }), options);
}

export async function loadGoogleToken(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(GOOGLE_TOKEN_KEY, options);
  if (!raw) return null;
  const { token, expiresAt } = JSON.parse(raw) as { token: string; expiresAt: number };
  return Date.now() < expiresAt ? token : null;
}

// Llave de cifrado de la base de datos: se genera una vez y vive solo en el almacén seguro.
export async function getDatabaseKey() {
  const existing = await SecureStore.getItemAsync(DB_KEY, options);
  if (existing) return existing;
  const key = Array.from(getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DB_KEY, key, options);
  return key;
}
