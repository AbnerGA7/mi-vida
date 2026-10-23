import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { ALLOWED_EMAIL, GOOGLE_ANDROID_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/lib/config';

WebBrowser.maybeCompleteAuthSession();

// Calendar y Gmail en solo lectura: la app nunca envía ni borra nada.
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export type GoogleUser = { email: string; name: string; picture?: string };

export function useGoogleAuthRequest() {
  return Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId: GOOGLE_WEB_CLIENT_ID,
    scopes: GOOGLE_SCOPES,
    // Siempre muestro el selector: el celular puede tener otra cuenta de Google abierta.
    selectAccount: true,
  });
}

export async function fetchGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('No pude leer tu perfil de Google');
  const data = await res.json();
  return { email: String(data.email).toLowerCase(), name: data.name, picture: data.picture };
}

export function isAllowedEmail(email: string) {
  return email.toLowerCase() === ALLOWED_EMAIL;
}
