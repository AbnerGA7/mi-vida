import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { useGoogleAuthRequest } from '@/lib/auth/google';
import { BRIEF_HOUR, buildBrief, scheduleMorningBrief, sendBriefNow, type Brief } from '@/lib/brief';
import { horaCorta, importantEmails, todayEvents, type Correo, type Evento } from '@/lib/google/api';
import { useSession } from '@/lib/session';
import { addTask, deleteTask, taskBucket, toggleTask, upcomingTasks, type Tarea } from '@/lib/tasks';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const BUCKET_COLOR: Record<string, string | undefined> = { vencida: '#D93025', hoy: '#E8A317' };

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function PanelScreen() {
  const c = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const { user, accessToken, signIn } = useSession();
  const [request, response, promptAsync] = useGoogleAuthRequest();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [correos, setCorreos] = useState<Correo[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [nueva, setNueva] = useState('');

  // El token de Google dura ~1 hora: si no hay o venció, pido reconectar.
  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      signIn(response.authentication.accessToken);
    }
  }, [response, signIn]);

  const cargar = useCallback(async () => {
    setCargando(true);
    let ev: Evento[] = [];
    let co: Correo[] = [];
    if (accessToken) {
      try {
        [ev, co] = await Promise.all([todayEvents(accessToken), importantEmails(accessToken)]);
        setGoogleError(null);
      } catch (e) {
        setGoogleError(e instanceof Error && e.message === 'TOKEN_EXPIRADO' ? 'Tu conexión con Google venció.' : 'No pude leer Google.');
      }
    }
    const [t, b] = await Promise.all([upcomingTasks(), buildBrief(ev, co)]);
    setEventos(ev);
    setCorreos(co);
    setTareas(t);
    setBrief(b);
    await scheduleMorningBrief(b);
    setCargando(false);
  }, [accessToken]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function agregarTarea() {
    if (!nueva.trim()) return;
    await addTask(nueva);
    setNueva('');
    cargar();
  }

  const card = [styles.card, { backgroundColor: c.backgroundElement }];
  const nombre = user?.name?.split(' ')[0] ?? '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={cargando} onRefresh={cargar} />}>
        <Text style={[styles.h1, { color: c.text }]}>
          {saludo()}{nombre ? `, ${nombre}` : ''} ☀️
        </Text>
        {brief ? <Text style={{ color: c.textSecondary, fontSize: 16 }}>{brief.titular}</Text> : <ActivityIndicator />}

        {(!accessToken || googleError) && (
          <View style={card}>
            <Text style={{ color: c.text }}>{googleError ?? 'Conecta Google para ver tu agenda y correos.'}</Text>
            <Pressable disabled={!request} onPress={() => promptAsync()} style={[styles.button, { backgroundColor: c.text }]}>
              <Text style={[styles.buttonLabel, { color: c.background }]}>Conectar Google</Text>
            </Pressable>
          </View>
        )}

        <View style={card}>
          <Text style={[styles.h2, { color: c.text }]}>📅 Agenda de hoy</Text>
          {eventos.length === 0 && <Text style={{ color: c.textSecondary }}>Nada en el calendario. Día libre para avanzar.</Text>}
          {eventos.map((e) => (
            <View key={e.id} style={styles.item}>
              <Text style={{ color: c.textSecondary, width: 56 }}>{e.todoElDia ? 'Todo el día' : horaCorta(e.inicio)}</Text>
              <Text style={{ color: c.text, flex: 1 }}>
                {e.titulo}
                {e.enlace ? ' 🎥' : ''}
              </Text>
            </View>
          ))}
        </View>

        <View style={card}>
          <Text style={[styles.h2, { color: c.text }]}>✅ Tareas</Text>
          <TextInput
            value={nueva}
            onChangeText={setNueva}
            onSubmitEditing={agregarTarea}
            placeholder='Ej. "pagar luz el viernes!"'
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text, borderColor: c.backgroundSelected }]}
            returnKeyType="done"
          />
          {tareas.length === 0 && <Text style={{ color: c.textSecondary }}>Sin pendientes para los próximos días.</Text>}
          {tareas.map((t) => {
            const bucket = taskBucket(t);
            return (
              <Pressable
                key={t.id}
                onPress={() => toggleTask(t.id).then(cargar)}
                onLongPress={() => deleteTask(t.id).then(cargar)}
                style={styles.item}>
                <Text style={{ fontSize: 18 }}>⬜</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text }}>
                    {t.prioridad === 'alta' ? '❗ ' : ''}
                    {t.titulo}
                  </Text>
                  <Text style={{ color: BUCKET_COLOR[bucket] ?? c.textSecondary, fontSize: 12 }}>
                    {bucket}
                    {t.fecha_limite ? ` · ${t.fecha_limite}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {correos.length > 0 && (
          <View style={card}>
            <Text style={[styles.h2, { color: c.text }]}>📧 Para responder</Text>
            {correos.map((m) => (
              <View key={m.id} style={{ paddingVertical: Spacing.one }}>
                <Text style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>{m.asunto}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12 }} numberOfLines={1}>
                  {m.de} · {m.fragmento}
                </Text>
              </View>
            ))}
          </View>
        )}

        {brief && brief.lineas.length > 0 && (
          <View style={card}>
            <Text style={[styles.h2, { color: c.text }]}>🗞️ Mi resumen</Text>
            {brief.lineas.map((l, i) => (
              <Text key={i} style={{ color: c.text }}>{l}</Text>
            ))}
            <Text style={{ color: c.textSecondary, fontSize: 12 }}>
              Te llega cada día a las {BRIEF_HOUR}:00 y se actualiza cada vez que abres la app.
            </Text>
            <Pressable onPress={() => sendBriefNow(brief)} style={[styles.button, { backgroundColor: c.backgroundSelected }]}>
              <Text style={[styles.buttonLabel, { color: c.text }]}>Enviarme el resumen ahora</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '600' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
});
