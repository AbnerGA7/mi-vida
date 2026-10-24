import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

// Guardo el último estado de la red en memoria: consultar NetInfo en cada pregunta suma latencia.
let last: NetInfoState | null = null;
let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  NetInfo.addEventListener((s) => {
    last = s;
  });
}

export async function isOnline() {
  ensureSubscribed();
  const s = last ?? (await NetInfo.fetch().catch(() => null));
  if (!s) return false;
  return Boolean(s.isConnected && s.isInternetReachable !== false);
}

export async function isWifi() {
  ensureSubscribed();
  const s = last ?? (await NetInfo.fetch().catch(() => null));
  return s?.type === 'wifi';
}
