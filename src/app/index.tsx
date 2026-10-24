import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';

import { alpha, Badge, Body, Button, Card, Divider, Empty, Input, ListItem, Muted, Row, Screen, Stat, useModule, usePalette } from '@/components/ui/kit';
import { Font, Spacing, Type } from '@/constants/theme';
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

const GOOGLE_TTL_MS = 5 * 60 * 1000;

function saludo() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function fechaLarga() {
  const f = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  return f.charAt(0).toUpperCase() + f.slice(1);
}

export default function HoyScreen() {
  const p = usePalette();
  const m = useModule('hoy');
  const { user, accessToken, signIn } = useSession();
  const [request, response, promptAsync] = useGoogleAuthRequest();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [correos, setCorreos] = useState<Correo[]>([]);
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [nueva, setNueva] = useState('');

  // El token de Google dura ~1 hora: si venció, reconecto desde aquí.
  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      signIn(response.authentication.accessToken, response.authentication.expiresIn);
    }
  }, [response, signIn]);

  // Google tarda y gasta datos (Gmail pide un detalle por correo): al cambiar de pestaña reuso
  // lo que bajé hace menos de 5 minutos. Deslizar hacia abajo siempre vuelve a pedirlo.
  const google = useRef<{ token: string | null; at: number; ev: Evento[]; co: Correo[] }>({ token: null, at: 0, ev: [], co: [] });

  const cargarGoogle = useCallback(
    async (forzar: boolean) => {
      const cache = google.current;
      if (!accessToken) return { ev: [], co: [] };
      if (!forzar && cache.token === accessToken && Date.now() - cache.at < GOOGLE_TTL_MS) return cache;
      try {
        const [ev, co] = await Promise.all([todayEvents(accessToken), importantEmails(accessToken)]);
        google.current = { token: accessToken, at: Date.now(), ev, co };
        setGoogleError(null);
        return google.current;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setGoogleError(msg === 'TOKEN_EXPIRADO' ? 'Tu conexión con Google venció.' : `No pude leer Google · ${msg}`);
        return { ev: [], co: [] };
      }
    },
    [accessToken],
  );

  const cargar = useCallback(
    async (forzar = false) => {
      setCargando(true);
      try {
        const [{ ev, co }, t] = await Promise.all([cargarGoogle(forzar), upcomingTasks()]);
        const b = await buildBrief(ev, co, t);
        setEventos(ev);
        setCorreos(co);
        setTareas(t);
        setBrief(b);
        await scheduleMorningBrief(b);
      } finally {
        setCargando(false);
      }
    },
    [cargarGoogle],
  );

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

  const nombre = user?.name?.split(' ')[0];
  const paraHoy = tareas.filter((t) => ['hoy', 'vencida'].includes(taskBucket(t))).length;
  const reuniones = eventos.filter((e) => !e.todoElDia).length;
  const BUCKET: Record<string, string> = { vencida: p.danger, hoy: p.warning, 'próximos días': p.primary, 'sin fecha': p.textSecondary };

  return (
    <Screen
      module="hoy"
      icon="white-balance-sunny"
      eyebrow={fechaLarga()}
      title={`${saludo()}${nombre ? `, ${nombre}` : ''}`}
      subtitle={brief?.titular}
      right={user?.picture ? <Image source={{ uri: user.picture }} style={styles.avatar} /> : undefined}
      refreshControl={<RefreshControl refreshing={cargando} onRefresh={() => cargar(true)} />}
      hero={
        <Row gap={10}>
          <Stat tone="hero" label="Tareas hoy" value={String(paraHoy)} icon="checkbox-marked-circle-outline" />
          <Stat tone="hero" label="Reuniones" value={String(reuniones)} icon="calendar-clock" />
          <Stat tone="hero" label="Correos" value={String(correos.length)} icon="email-outline" />
        </Row>
      }>
      {(!accessToken || googleError) && (
        <Card title="Conecta Google" subtitle="Agenda y correos en solo lectura" icon="google" accent={p.primary} variant="tinted">
          <Muted>{googleError ?? 'Conecta tu cuenta para ver tu agenda y tus correos importantes.'}</Muted>
          <Button label="Conectar Google" icon="link-variant" disabled={!request} onPress={() => promptAsync()} />
        </Card>
      )}

      <Card
        title="Agenda de hoy"
        icon="calendar-today"
        accent={m.solid}
        right={eventos.length ? <Badge label={`${eventos.length}`} color={m.solid} /> : undefined}>
        {eventos.length === 0 ? (
          <Empty icon="calendar-blank-outline" color={m.solid} text="Nada en el calendario. Día libre para avanzar." />
        ) : (
          <View>
            {eventos.map((e, i) => (
              <View key={e.id} style={styles.event}>
                <View style={styles.eventTime}>
                  <Text style={[Type.callout, { color: p.text, fontFamily: Font.bold }]}>{e.todoElDia ? 'Día' : horaCorta(e.inicio)}</Text>
                  {!e.todoElDia ? <Text style={[Type.caption, { color: p.textTertiary }]}>{horaCorta(e.fin)}</Text> : null}
                </View>
                <View style={styles.eventRail}>
                  <View style={[styles.eventDot, { backgroundColor: m.solid, boxShadow: `0px 0px 0px 4px ${alpha(m.solid, 0.18)}` }]} />
                  {i < eventos.length - 1 ? <View style={[styles.eventLine, { backgroundColor: p.border }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: Spacing.three, gap: 2 }}>
                  <Body bold>{e.titulo}</Body>
                  <Muted size={12}>{e.todoElDia ? 'Todo el día' : e.enlace ? 'Videollamada' : 'Presencial'}</Muted>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card title="Tareas" subtitle="Escribe como hablas" icon="format-list-checks" accent={p.primary} right={<Badge label={String(tareas.length)} color={p.primary} />}>
        <Input
          icon="plus-circle-outline"
          value={nueva}
          onChangeText={setNueva}
          onSubmitEditing={agregarTarea}
          placeholder='Ej. "pagar luz el viernes!"'
          returnKeyType="done"
        />
        {tareas.length === 0 ? (
          <Empty icon="party-popper" color={p.success} text="Sin pendientes para los próximos días." />
        ) : (
          tareas.map((t) => {
            const bucket = taskBucket(t);
            return (
              <ListItem
                key={t.id}
                icon={t.prioridad === 'alta' ? 'alert-circle-outline' : 'checkbox-blank-circle-outline'}
                iconColor={BUCKET[bucket]}
                title={t.titulo}
                subtitle={t.fecha_limite ?? undefined}
                right={<Badge label={bucket} color={BUCKET[bucket]} />}
                onPress={() => toggleTask(t.id).then(() => cargar())}
                onLongPress={() => deleteTask(t.id).then(() => cargar())}
              />
            );
          })
        )}
        <Muted size={12}>Toca para completar · mantén presionado para borrar</Muted>
      </Card>

      {correos.length > 0 && (
        <Card title="Para responder" subtitle="Importantes sin leer · 48 h" icon="email-alert-outline" accent={p.danger}>
          {correos.map((c, i) => (
            <View key={c.id} style={{ gap: Spacing.two }}>
              {i > 0 ? <Divider /> : null}
              <ListItem icon="account-circle-outline" iconColor={p.textSecondary} title={c.asunto} subtitle={`${c.de} · ${c.fragmento}`} />
            </View>
          ))}
        </Card>
      )}

      {brief && brief.lineas.length > 0 && (
        <Card title="Mi resumen" icon="newspaper-variant-outline" accent={m.solid}>
          {brief.lineas.map((l, i) => (
            <Body key={i}>{l}</Body>
          ))}
          <Muted size={12}>Te llega cada día a las {BRIEF_HOUR}:00 y se actualiza cada vez que abres la app.</Muted>
          <Button label="Enviarme el resumen ahora" icon="bell-ring-outline" variant="secondary" onPress={() => sendBriefNow(brief)} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  event: { flexDirection: 'row', gap: Spacing.three - 4 },
  eventTime: { width: 50, alignItems: 'flex-end', paddingTop: 1 },
  eventRail: { width: 12, alignItems: 'center', paddingTop: 6 },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventLine: { width: 2, flex: 1, marginTop: 6, borderRadius: 1 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
});
