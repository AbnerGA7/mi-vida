import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { useGoogleAuthRequest } from '@/lib/auth/google';
import { useSession } from '@/lib/session';

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === 'unlocked') return children;
  if (status === 'loading') return <Screen><ActivityIndicator /></Screen>;
  return status === 'locked' ? <LockScreen /> : <LoginScreen />;
}

function LoginScreen() {
  const { signIn, error } = useSession();
  const [request, response, promptAsync] = useGoogleAuthRequest();

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      signIn(response.authentication.accessToken);
    }
  }, [response, signIn]);

  return (
    <Screen>
      <Title>Mi Vida</Title>
      <Subtitle>Tu plata, tu cuerpo, tus papeles y tu día, en un solo lugar.</Subtitle>
      <Button label="Entrar con Google" disabled={!request} onPress={() => promptAsync()} />
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

function LockScreen() {
  const { unlock, signOut, user, error } = useSession();

  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <Screen>
      <Title>🔒 Bloqueado</Title>
      <Subtitle>{user?.email}</Subtitle>
      <Button label="Desbloquear con huella" onPress={unlock} />
      <Pressable onPress={signOut}>
        <Subtitle>Cerrar sesión</Subtitle>
      </Pressable>
      {error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

function useColors() {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

function Screen({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.screen, { backgroundColor: c.background }]}>{children}</View>;
}

function Title({ children }: { children: ReactNode }) {
  return <Text style={[styles.title, { color: useColors().text }]}>{children}</Text>;
}

function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={[styles.subtitle, { color: useColors().textSecondary }]}>{children}</Text>;
}

function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, { backgroundColor: c.text, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={[styles.buttonLabel, { color: c.background }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16, textAlign: 'center' },
  error: { color: '#D93025', textAlign: 'center' },
  button: { paddingVertical: Spacing.three, paddingHorizontal: Spacing.five, borderRadius: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
