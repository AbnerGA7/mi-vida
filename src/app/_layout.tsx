import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AssistantLauncher } from '@/components/assistant';
import { AuthGate } from '@/components/auth-gate';
import { Colors } from '@/constants/theme';
import { warmUpLocal } from '@/lib/ai/local';
import { isOnline } from '@/lib/ai/net';
import { getAiPrefs } from '@/lib/ai/prefs';
import { getDb } from '@/lib/db';
import { SessionProvider } from '@/lib/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Si una pantalla falla, muestro un aviso con "Reintentar" en vez de cerrar la app.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  const scheme = useColorScheme();
  const c = Colors[scheme === 'dark' ? 'dark' : 'light'];
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: c.background }}>
      <Text style={{ fontSize: 40 }}>😵‍💫</Text>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Algo se trabó</Text>
      <Text style={{ color: c.textSecondary, textAlign: 'center' }}>{error.message}</Text>
      <Pressable
        onPress={retry}
        style={{ backgroundColor: c.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, marginTop: 8 }}>
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Reintentar</Text>
      </Pressable>
    </View>
  );
}

// Ya desbloqueada la app: abro la base de datos y, si voy a necesitar la IA local, la despierto
// en segundo plano cuando la pantalla termina de dibujarse. Así la primera pregunta no espera.
function Preload() {
  useEffect(() => {
    let warm: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(async () => {
      getDb().catch(() => {});
      const [prefs, online] = await Promise.all([getAiPrefs(), isOnline()]);
      if (prefs.privacidadEstricta || !online) warm = setTimeout(() => warmUpLocal(), 1500);
    }, 800);
    return () => {
      clearTimeout(t);
      if (warm) clearTimeout(warm);
    };
  }, []);
  return null;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <SessionProvider>
        <AuthGate>
          <View style={{ flex: 1 }}>
            <AppTabs />
            <AssistantLauncher />
            <Preload />
          </View>
        </AuthGate>
      </SessionProvider>
    </ThemeProvider>
  );
}
