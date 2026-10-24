import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl } from 'react-native';

import { Badge, Body, Button, Card, Empty, Icon, Input, ListItem, Muted, Notice, Row, Screen, Stat, useModule, usePalette } from '@/components/ui/kit';
import { useLoader } from '@/hooks/use-loader';
import { friendlyError } from '@/lib/ai';
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
  const [nueva, setNueva] = useState('');

  // El token de Google dura ~1 hora: si venció, reconecto desde aquí.
  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      signIn(response.authentication.accessToken, response.authentication.expiresIn);
    }
  }, [response, signIn]);

  // Primero lo local (instantáneo), después Google (red): la pantalla no espera a internet.
  // Google se consulta como mucho cada 2 minutos (completar una tarea no debe llamar a la red).
  const googleAt = useRef(0);
  const forzar = useRef(false);
  const cargarGoogle = useCallback(async () => {
    let ev: Evento[] = eventos;
    let co: Correo[] = correos;
    const fresco = Date.now() - googleAt.current < 120000;
    if (accessToken && (forzar.current || !fresco)) {
      forzar.current = false;
      googleAt.current = Date.now();
      try {
        [ev, co] = await Promise.all([todayEvents(accessToken), importantEmails(accessToken)]);
        setEventos(ev);
        setCorreos(co);
        setGoogleError(null);
      } catch (e) {
        googleAt.current = 0;
        const msg = e instanceof Error ? e.message : String(e);
        setGoogleError(msg === 'TOKEN_EXPIRADO' ? 'Tu conexión con Google venció.' : `No pude leer Google · ${msg}`);
      }
    }
    return { ev, co };
  }, [accessToken, eventos, correos]);

  const cargarGoogleRef = useRef(cargarGoogle);
  useEffect(() => {
    cargarGoogleRef.current = cargarGoogle;
  }, [cargarGoogle]);

  const { loading: cargando, error, reload: cargar } = useLoader(async () => {
    const [t, bLocal] = await Promise.all([upcomingTasks(), buildBrief(eventos, correos)]);
    setTareas(t);
    setBrief(bLocal);
    const { ev, co } = await cargarGoogleRef.current();
    const b = accessToken ? await buildBrief(ev, co) : bLocal;
    setBrief(b);
    // La notificación se programa en segundo plano: nunca bloquea la pantalla.
    scheduleMorningBrief(b).catch(() => {});
  }, ['tareas', 'finanzas', 'documentos', 'coach']);

  // Al reconectar Google recargo para traer agenda y correos.
  const [tokenAnterior, setTokenAnterior] = useState(accessToken);
  useEffect(() => {
    if (accessToken !== tokenAnterior) {
      setTokenAnterior(accessToken);
      if (accessToken) {
        forzar.current = true;
        cargar();
      }
    }
  }, [accessToken, tokenAnterior, cargar]);

  async function agregarTarea() {
    const texto = nueva.trim();
    if (!texto) return;
    setNueva('');
    try {
      await addTask(texto);
    } catch (e) {
      setNueva(texto);
      Alert.alert('No pude crear la tarea', friendlyError(e));
    }
  }

  // Completar/borrar se ve al toque; si la base falla, recargo para volver al estado real.
  function completar(t: Tarea) {
    setTareas((prev) => prev.filter((x) => x.id !== t.id));
    toggleTask(t.id).catch(() => cargar());
  }

  function borrarTarea(t: Tarea) {
    Alert.alert('¿Borrar tarea?', t.titulo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          setTareas((prev) => prev.filter((x) => x.id !== t.id));
          deleteTask(t.id).catch(() => cargar());
        },
      },
    ]);
  }

  const nombre = user?.name?.split(' ')[0];
  const paraHoy = tareas.filter((t) => ['hoy', 'vencida'].includes(taskBucket(t))).length;
  const reuniones = eventos.filter((e) => !e.todoElDia).length;
  const BUCKET: Record<string, string> = { vencida: p.danger, hoy: p.warning, 'próximos días': p.primary, 'sin fecha': p.textSecondary };

  return (
    <Screen
      module="hoy"
      icon="white-balance-sunny"
      title={`${saludo()}${nombre ? `, ${nombre}` : ''}`}
      subtitle={fechaLarga()}
      refreshControl={
        <RefreshControl
          refreshing={cargando}
          onRefresh={() => {
            forzar.current = true;
            cargar();
          }}
        />
      }>
      {error ? <Notice tone="danger" text={`No pude cargar tu día: ${error}`} actionLabel="Reintentar" onAction={cargar} /> : null}
      {brief ? (
        <Card>
          <Row>
            <Icon name="star-four-points" color={m.solid} />
            <Body bold>{brief.titular}</Body>
          </Row>
        </Card>
      ) : null}

      <Row gap={10}>
        <Stat label="Tareas hoy" value={String(paraHoy)} icon="checkbox-marked-circle-outline" color={paraHoy ? p.warning : p.success} />
        <Stat label="Reuniones" value={String(reuniones)} icon="calendar-clock" color={m.solid} />
        <Stat label="Correos" value={String(correos.length)} icon="email-outline" color={p.primary} />
      </Row>

      {(!accessToken || googleError) && (
        <Card title="Conecta Google" icon="google" accent={p.primary}>
          <Muted>{googleError ?? 'Conecta tu cuenta para ver tu agenda y tus correos importantes.'}</Muted>
          <Button label="Conectar Google" icon="link-variant" disabled={!request} onPress={() => promptAsync()} />
        </Card>
      )}

      <Card title="Agenda de hoy" icon="calendar-today" accent={m.solid}>
        {eventos.length === 0 ? (
          <Empty icon="calendar-blank-outline" text="Nada en el calendario. Día libre para avanzar." />
        ) : (
          eventos.map((e) => (
            <ListItem
              key={e.id}
              icon={e.enlace ? 'video-outline' : 'clock-outline'}
              iconColor={m.solid}
              title={e.titulo}
              subtitle={e.todoElDia ? 'Todo el día' : `${horaCorta(e.inicio)} – ${horaCorta(e.fin)}`}
            />
          ))
        )}
      </Card>

      <Card title="Tareas" icon="format-list-checks" accent={p.primary} right={<Badge label={String(tareas.length)} color={p.primary} />}>
        <Input
          icon="plus"
          value={nueva}
          onChangeText={setNueva}
          onSubmitEditing={agregarTarea}
          placeholder='Ej. "pagar luz el viernes!"'
          returnKeyType="done"
        />
        {tareas.length === 0 ? (
          <Empty icon="party-popper" text="Sin pendientes para los próximos días." />
        ) : (
          tareas.map((t) => {
            const bucket = taskBucket(t);
            return (
              <ListItem
                key={t.id}
                icon="checkbox-blank-circle-outline"
                iconColor={BUCKET[bucket]}
                title={`${t.prioridad === 'alta' ? '❗ ' : ''}${t.titulo}`}
                subtitle={`${bucket}${t.fecha_limite ? ` · ${t.fecha_limite}` : ''}`}
                onPress={() => completar(t)}
                onLongPress={() => borrarTarea(t)}
              />
            );
          })
        )}
        <Muted size={12}>Toca para completar · mantén presionado para borrar · o pídeselo al asistente ✨</Muted>
      </Card>

      {correos.length > 0 && (
        <Card title="Para responder" icon="email-alert-outline" accent={p.danger}>
          {correos.map((c) => (
            <ListItem key={c.id} icon="account-circle-outline" iconColor={p.textSecondary} title={c.asunto} subtitle={`${c.de} · ${c.fragmento}`} />
          ))}
        </Card>
      )}

      {brief && brief.lineas.length > 0 && (
        <Card title="Mi resumen" icon="newspaper-variant-outline" accent={m.solid}>
          {brief.lineas.map((l, i) => (
            <Body key={i}>{l}</Body>
          ))}
          <Muted size={12}>Te llega cada día a las {BRIEF_HOUR}:00 y se actualiza cada vez que abres la app.</Muted>
          <Button
            label="Enviarme el resumen ahora"
            icon="bell-ring-outline"
            variant="secondary"
            onPress={() => sendBriefNow(brief).catch((e) => Alert.alert('No pude enviar la notificación', friendlyError(e)))}
          />
        </Card>
      )}
    </Screen>
  );
}
