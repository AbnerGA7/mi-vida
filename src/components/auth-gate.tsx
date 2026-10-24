import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandGradient, Font, Spacing, Type } from '@/constants/theme';
import { useGoogleAuthRequest } from '@/lib/auth/google';
import { useSession } from '@/lib/session';


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
      <Animated.View entering={FadeInDown.delay(100).springify().damping(18)} style={styles.top}>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={styles.title}>Mi Vida</Text>
        <Text style={styles.subtitle}>Tu plata, tu cuerpo, tus papeles y tu día, en un solo lugar.</Text>
      </Animated.View>

      <View style={styles.features}>
        {FEATURES.map((f, i) => (
          <Animated.View key={f.text} entering={FadeInDown.delay(260 + i * 70).springify().damping(18)}>
            <Feature icon={f.icon} text={f.text} />
          </Animated.View>
        ))}
      </View>

      <Animated.View entering={FadeIn.delay(600).duration(400)} style={styles.bottom}>
        <Pressable
          disabled={!request}
          onPress={() => promptAsync()}
          style={({ pressed }) => [styles.google, { opacity: !request ? 0.6 : pressed ? 0.9 : 1 }]}>
          <MaterialCommunityIcons name="google" size={22} color="#0B3B36" />
          <Text style={styles.googleLabel}>Entrar con Google</Text>
        </Pressable>
        {error ? <ErrorBox text={error} /> : <Text style={styles.note}>Solo lectura de Gmail y Calendar · protegido con huella</Text>}
      </Animated.View>
    </Shell>
  );
}

const FEATURES: { icon: ComponentProps<typeof MaterialCommunityIcons>['name']; text: string }[] = [
  { icon: 'cash-multiple', text: 'Controla tus gastos y presupuestos' },
  { icon: 'brain', text: 'Pregúntale a tus documentos' },
  { icon: 'dumbbell', text: 'Rutina y menú que se ajustan a ti' },
  { icon: 'shield-lock', text: 'IA local: tus datos no salen del celular' },
];

function LockScreen() {
  const { unlock, signOut, user, error } = useSession();

  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <Shell>
      <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.top}>
        <View style={styles.lockCircle}>
          <MaterialCommunityIcons name="fingerprint" size={64} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Hola{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.bottom}>
        <Pressable onPress={unlock} style={({ pressed }) => [styles.google, { opacity: pressed ? 0.9 : 1 }]}>
          <MaterialCommunityIcons name="lock-open-variant" size={22} color="#0B3B36" />
          <Text style={styles.googleLabel}>Desbloquear</Text>
        </Pressable>
        <Pressable onPress={signOut} style={styles.link}>
          <Text style={styles.linkLabel}>Cerrar sesión</Text>
        </Pressable>
        {error ? <ErrorBox text={error} /> : null}
      </Animated.View>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={BrandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.orb, { width: 340, height: 340, top: -120, right: -120 }]} />
        <View style={[styles.orb, { width: 220, height: 220, bottom: 80, left: -110, opacity: 0.6 }]} />
        <View style={[styles.orb, { width: 90, height: 90, top: 180, left: 40, backgroundColor: 'rgba(253,176,34,0.18)' }]} />
      </View>
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
  logo: { width: 108, height: 108, borderRadius: 32, marginBottom: Spacing.three, boxShadow: '0px 18px 40px -10px rgba(0,0,0,0.45)' },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  lockWrap: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.three },
  lockRing: { position: 'absolute', marginBottom: 0, backgroundColor: 'rgba(255,255,255,0.3)' },
  lockCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: { ...Type.display, color: '#FFFFFF' },
  subtitle: { ...Type.body, fontSize: 16, lineHeight: 23, color: 'rgba(255,255,255,0.85)', textAlign: 'center', maxWidth: 300 },
  features: { gap: Spacing.three, paddingHorizontal: Spacing.two },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { ...Type.callout, fontSize: 15, color: '#FFFFFF', flex: 1 },
  bottom: { gap: Spacing.three, marginBottom: Spacing.three },
  google: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 17,
    boxShadow: '0px 14px 30px -12px rgba(0,0,0,0.45)',
  },
  googleLabel: { fontFamily: Font.bold, color: '#0B3B36', fontSize: 16.5 },
  note: { ...Type.caption, fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  link: { alignItems: 'center', padding: Spacing.two },
  linkLabel: { fontFamily: Font.semibold, color: 'rgba(255,255,255,0.85)', fontSize: 15 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(220,38,38,0.85)',
    borderRadius: 12,
    padding: Spacing.three,
  },
  errorText: { ...Type.callout, color: '#FFFFFF', flex: 1 },
});
