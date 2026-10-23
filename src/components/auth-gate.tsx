import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useGoogleAuthRequest } from '@/lib/auth/google';
import { useSession } from '@/lib/session';

const BRAND = ['#14B8A6', '#0F766E', '#0B3B36'] as const;

export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === 'unlocked') return children;
  if (status === 'loading') {
    return (
      <Shell>
        <ActivityIndicator color="#FFFFFF" size="large" />
      </Shell>
    );
  }
  return status === 'locked' ? <LockScreen /> : <LoginScreen />;
}

function LoginScreen() {
  const { signIn, error } = useSession();
  const [request, response, promptAsync] = useGoogleAuthRequest();

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      signIn(response.authentication.accessToken, response.authentication.expiresIn);
    }
  }, [response, signIn]);

  return (
    <Shell>
      <View style={styles.top}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Mi Vida</Text>
        <Text style={styles.subtitle}>Tu plata, tu cuerpo, tus papeles y tu día, en un solo lugar.</Text>
      </View>

      <View style={styles.features}>
        <Feature icon="cash-multiple" text="Controla tus gastos y presupuestos" />
        <Feature icon="brain" text="Pregúntale a tus documentos" />
        <Feature icon="dumbbell" text="Rutina y menú que se ajustan a ti" />
        <Feature icon="shield-lock" text="IA local: tus datos no salen del celular" />
      </View>

      <View style={styles.bottom}>
        <Pressable
          disabled={!request}
          onPress={() => promptAsync()}
          style={({ pressed }) => [styles.google, { opacity: !request ? 0.6 : pressed ? 0.9 : 1 }]}>
          <MaterialCommunityIcons name="google" size={22} color="#0B3B36" />
          <Text style={styles.googleLabel}>Entrar con Google</Text>
        </Pressable>
        {error ? <ErrorBox text={error} /> : <Text style={styles.note}>Solo lectura de Gmail y Calendar · protegido con huella</Text>}
      </View>
    </Shell>
  );
}

function LockScreen() {
  const { unlock, signOut, user, error } = useSession();

  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <Shell>
      <View style={styles.top}>
        <View style={styles.lockCircle}>
          <MaterialCommunityIcons name="fingerprint" size={64} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Hola{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </View>

      <View style={styles.bottom}>
        <Pressable onPress={unlock} style={({ pressed }) => [styles.google, { opacity: pressed ? 0.9 : 1 }]}>
          <MaterialCommunityIcons name="lock-open-variant" size={22} color="#0B3B36" />
          <Text style={styles.googleLabel}>Desbloquear</Text>
        </Pressable>
        <Pressable onPress={signOut} style={styles.link}>
          <Text style={styles.linkLabel}>Cerrar sesión</Text>
        </Pressable>
        {error ? <ErrorBox text={error} /> : null}
      </View>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={BRAND} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <SafeAreaView style={styles.shell}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

function Feature({ icon, text }: { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }) {
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}>
        <MaterialCommunityIcons name={icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <View style={styles.error}>
      <MaterialCommunityIcons name="alert-circle" size={18} color="#FFFFFF" />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, padding: Spacing.four, justifyContent: 'space-between' },
  top: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  logo: { width: 112, height: 112, borderRadius: 28, marginBottom: Spacing.two },
  lockCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.88)', fontSize: 16, textAlign: 'center', maxWidth: 300 },
  features: { gap: Spacing.three, paddingHorizontal: Spacing.two },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { color: '#FFFFFF', fontSize: 15, flex: 1 },
  bottom: { gap: Spacing.three, marginBottom: Spacing.three },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
  },
  googleLabel: { color: '#0B3B36', fontSize: 17, fontWeight: '800' },
  note: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center' },
  link: { alignItems: 'center', padding: Spacing.two },
  linkLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(220,38,38,0.85)',
    borderRadius: 12,
    padding: Spacing.three,
  },
  errorText: { color: '#FFFFFF', flex: 1 },
});
