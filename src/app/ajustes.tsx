import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { askAi } from '@/lib/ai';
import { hasCloudKey } from '@/lib/ai/cloud';
import { deleteLocalModel, downloadLocalModel, hasSpaceForModel, isLocalModelReady } from '@/lib/ai/local';
import { GEMINI_MODEL, LOCAL_MODEL } from '@/lib/config';
import { useSession } from '@/lib/session';

type C = Record<keyof (typeof Colors)['light'], string>;
const VERDE = '#3A9D5D';
const ROJO = '#D93025';

export default function AjustesScreen() {
  const c = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { user, accessToken, signOut } = useSession();
  const [listo, setListo] = useState<boolean | null>(null);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [prueba, setPrueba] = useState<string | null>(null);
  const [probando, setProbando] = useState(false);

  const cargar = useCallback(async () => setListo(await isLocalModelReady()), []);
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function descargar() {
    if (!(await hasSpaceForModel())) {
      Alert.alert('Sin espacio', 'Necesitas unos 2.5 GB libres para la IA local.');
      return;
    }
    const net = await NetInfo.fetch();
    const empezar = async () => {
      setProgreso(0);
      try {
        await downloadLocalModel(setProgreso);
        await cargar();
      } catch (e) {
        Alert.alert('No se pudo descargar', e instanceof Error ? e.message : String(e));
      } finally {
        setProgreso(null);
      }
    };
    if (net.type !== 'wifi') {
      Alert.alert('Sin Wi-Fi', 'La IA local pesa unos 2 GB. ¿Descargar con datos móviles?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descargar igual', onPress: empezar },
      ]);
    } else {
      await empezar();
    }
  }

  function borrar() {
    Alert.alert('¿Borrar la IA local?', 'Libera ~2 GB. Finanzas y documentos no podrán usar IA hasta que la descargues de nuevo.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => deleteLocalModel().then(cargar) },
    ]);
  }

  async function probar(privado: boolean) {
    setProbando(true);
    setPrueba(null);
    const inicio = Date.now();
    try {
      const { text, source } = await askAi(
        [{ role: 'user', content: 'Responde en una frase corta: ¿qué es un presupuesto mensual?' }],
        { privado, maxTokens: 60 },
      );
      setPrueba(`IA ${source} · ${((Date.now() - inicio) / 1000).toFixed(1)} s\n${text}`);
    } catch (e) {
      setPrueba(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProbando(false);
    }
  }

  function cerrarSesion() {
    Alert.alert('¿Cerrar sesión?', 'Tus datos se quedan cifrados en el celular.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: c.text }]}>⚙️ Ajustes</Text>

        <Card c={c} title="🤖 IA local (sin internet)">
          <Text style={{ color: c.textSecondary }}>{LOCAL_MODEL.name} · ~2 GB · corre dentro del celular</Text>
          {listo === null && <ActivityIndicator />}
          {listo === true && <Status ok text="Descargada y lista" />}
          {listo === false && progreso === null && <Status ok={false} text="No descargada" />}

          {progreso !== null && (
            <View style={{ gap: Spacing.one }}>
              <View style={[styles.track, { backgroundColor: c.backgroundSelected }]}>
                <View style={[styles.bar, { width: `${Math.round(progreso * 100)}%`, backgroundColor: c.text }]} />
              </View>
              <Text style={{ color: c.textSecondary }}>Descargando… {Math.round(progreso * 100)}% (no cierres la app)</Text>
            </View>
          )}

          {listo === false && progreso === null && <Button c={c} label="Descargar IA local" onPress={descargar} />}
          {listo && <Button c={c} label="Borrar IA local" onPress={borrar} secondary />}
        </Card>

        <Card c={c} title="☁️ IA en la nube (con internet)">
          <Text style={{ color: c.textSecondary }}>{GEMINI_MODEL} · plan gratis de Google</Text>
          <Status ok={hasCloudKey()} text={hasCloudKey() ? 'Clave configurada' : 'Falta EXPO_PUBLIC_GEMINI_API_KEY en el .env'} />
          <Text style={{ color: c.textSecondary, fontSize: 12 }}>
            Finanzas y documentos siempre usan la IA local: esos datos nunca salen del celular.
          </Text>
        </Card>

        <Card c={c} title="🧪 Probar la IA">
          <View style={styles.row}>
            <Button c={c} label="Modo híbrido" onPress={() => probar(false)} disabled={probando} flex />
            <Button c={c} label="Solo local" onPress={() => probar(true)} disabled={probando} flex secondary />
          </View>
          {probando && <ActivityIndicator />}
          {prueba && <Text style={{ color: c.text }}>{prueba}</Text>}
        </Card>

        <Card c={c} title="🔐 Cuenta">
          <Text style={{ color: c.text }}>{user?.email}</Text>
          <Status ok={!!accessToken} text={accessToken ? 'Google conectado' : 'Google desconectado (reconecta desde Hoy)'} />
          <Status ok text="Base de datos cifrada con SQLCipher" />
          <Status ok text="Bloqueo con huella al volver a la app" />
          <Button c={c} label="Cerrar sesión" onPress={cerrarSesion} secondary />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Status({ ok, text }: { ok: boolean; text: string }) {
  return <Text style={{ color: ok ? VERDE : ROJO }}>{ok ? '●' : '○'} {text}</Text>;
}

function Card({ c, title, children }: { c: C; title: string; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
      <Text style={[styles.h2, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Button({
  c,
  label,
  onPress,
  disabled,
  secondary,
  flex,
}: {
  c: C;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        flex && { flex: 1 },
        { backgroundColor: secondary ? c.backgroundSelected : c.text, opacity: disabled ? 0.6 : 1 },
      ]}>
      <Text style={[styles.buttonLabel, { color: secondary ? c.text : c.background }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '600' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 5 },
  button: { borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
