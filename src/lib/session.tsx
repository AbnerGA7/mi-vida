import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { canUseBiometrics, unlockWithBiometrics } from '@/lib/auth/biometric';
import { fetchGoogleUser, isAllowedEmail, type GoogleUser } from '@/lib/auth/google';
import { LOCK_AFTER_MINUTES } from '@/lib/config';
import { clearUser, loadGoogleToken, loadUser, saveGoogleToken, saveUser } from '@/lib/secure-store';

type Status = 'loading' | 'signedOut' | 'locked' | 'unlocked';

type Session = {
  status: Status;
  user: GoogleUser | null;
  accessToken: string | null;
  error: string | null;
  signIn: (accessToken: string, expiresIn?: number) => Promise<void>;
  unlock: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    loadUser().then((saved) => {
      setUser(saved);
      setStatus(saved ? 'locked' : 'signedOut');
    });
  }, []);

  // Vuelvo a bloquear si la app estuvo en segundo plano más del tiempo permitido.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundAt.current = Date.now();
      if (state === 'active' && backgroundAt.current) {
        const minutes = (Date.now() - backgroundAt.current) / 60000;
        backgroundAt.current = null;
        if (minutes >= LOCK_AFTER_MINUTES) setStatus((s) => (s === 'unlocked' ? 'locked' : s));
      }
    });
    return () => sub.remove();
  }, []);

  const signIn = useCallback(async (token: string, expiresIn?: number) => {
    setError(null);
    const googleUser = await fetchGoogleUser(token);
    if (!isAllowedEmail(googleUser.email)) {
      setError(`Acceso denegado para ${googleUser.email}`);
      return;
    }
    if (!(await canUseBiometrics())) {
      setError('Activa una huella o PIN en tu celular para proteger la app.');
      return;
    }
    await saveUser(googleUser);
    await saveGoogleToken(token, expiresIn);
    setUser(googleUser);
    setAccessToken(token);
    setStatus('unlocked');
  }, []);

  const unlock = useCallback(async () => {
    setError(null);
    if (await unlockWithBiometrics()) {
      // Si el token de Google sigue vigente, lo recupero para no pedir reconectar.
      setAccessToken(await loadGoogleToken());
      setStatus('unlocked');
    } else {
      setError('No se pudo verificar tu identidad.');
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearUser();
    setUser(null);
    setAccessToken(null);
    setStatus('signedOut');
  }, []);

  return (
    <SessionContext.Provider value={{ status, user, accessToken, error, signIn, unlock, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de SessionProvider');
  return ctx;
}
