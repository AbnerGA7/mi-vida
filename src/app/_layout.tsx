import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth-gate';
import { Colors } from '@/constants/theme';
import { SessionProvider } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // La pantalla de inicio se queda hasta que la tipografía esté lista (si falla, sigo con la del sistema).
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  if (!fontsLoaded && !fontError) return null;

  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: c.background, card: c.backgroundElement, primary: c.primary } }}>
      <AnimatedSplashOverlay />
      <SessionProvider>
        <AuthGate>
          <AppTabs />
        </AuthGate>
      </SessionProvider>
    </ThemeProvider>
  );
}
