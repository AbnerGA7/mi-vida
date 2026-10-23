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
}

// Llave de cifrado de la base de datos: se genera una vez y vive solo en el almacén seguro.
export async function getDatabaseKey() {
  const existing = await SecureStore.getItemAsync(DB_KEY, options);
  if (existing) return existing;
  const key = Array.from(getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(DB_KEY, key, options);
  return key;
}
