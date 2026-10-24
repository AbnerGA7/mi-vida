import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Switch, View } from 'react-native';

import { Badge, Body, Button, Card, ListItem, Muted, Progress, Row, Screen, StreamingText, useModule, usePalette } from '@/components/ui/kit';
import { useLoader } from '@/hooks/use-loader';
import { askAi, friendlyError, planRoute } from '@/lib/ai';
import { hasCloudKey } from '@/lib/ai/cloud';
import {
  cancelDownload,
  deleteLocalModel,
  downloadedModels,
  downloadLocalModel,
  hasSpaceForModel,
  localStatus,
  onLocalStatusChange,
  releaseLocal,
  warmUpLocal,
} from '@/lib/ai/local';
import { isWifi } from '@/lib/ai/net';
import { getAiPrefs, setAiPrefs, type AiPrefs } from '@/lib/ai/prefs';
import { AiCancelled } from '@/lib/ai/types';
import { GEMINI_FAST_MODEL, GEMINI_MODEL, LOCAL_MODELS, type LocalModelId } from '@/lib/config';
import { useSession } from '@/lib/session';

const ESTADO_MOTOR = {
  'sin-modelo': 'Sin modelo',
  dormida: 'Dormida (se despierta al usarla)',
  cargando: 'Despertando…',
  lista: 'Lista en memoria ⚡',
  pensando: 'Pensando…',
} as const;

export default function AjustesScreen() {
  const p = usePalette();
  const m = useModule('ajustes');
  const { user, accessToken, signOut } = useSession();
  const [descargados, setDescargados] = useState<LocalModelId[] | null>(null);
  const [prefs, setPrefs] = useState<AiPrefs | null>(null);
  const [descarga, setDescarga] = useState<{ id: LocalModelId; progreso: number } | null>(null);
  const [motor, setMotor] = useState(localStatus());
  const [prueba, setPrueba] = useState<{ texto: string; info: string } | null>(null);
  const [probando, setProbando] = useState(false);

  const { reload: cargar } = useLoader(async () => {
    const [d, pr] = await Promise.all([downloadedModels(), getAiPrefs()]);
    setDescargados(d);
    setPrefs(pr);
  });

  useEffect(() => onLocalStatusChange(() => setMotor(localStatus())), []);

  async function descargar(id: LocalModelId) {
    const info = LOCAL_MODELS[id];
    if (!(await hasSpaceForModel(id))) {
      Alert.alert('Sin espacio', `Necesitas unos ${((info.bytes * 1.2) / 1e9).toFixed(1)} GB libres para este modelo.`);
      return;
    }
    const empezar = async () => {
      setDescarga({ id, progreso: 0 });
      try {
        await downloadLocalModel(id, (progreso) => setDescarga({ id, progreso }));
        await setAiPrefs({ modeloLocal: id });
        await releaseLocal();
        await cargar();
      } catch (e) {
        if (!(e instanceof AiCancelled)) Alert.alert('No se pudo descargar', friendlyError(e));
      } finally {
        setDescarga(null);
      }
    };
    if (!(await isWifi())) {
      Alert.alert('Sin Wi-Fi', `Este modelo pesa ${(info.bytes / 1e9).toFixed(1)} GB. ¿Descargar con datos móviles?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descargar igual', onPress: empezar },
      ]);
    } else {
      await empezar();
    }
  }

  function borrar(id: LocalModelId) {
    Alert.alert(`¿Borrar ${LOCAL_MODELS[id].name}?`, `Libera ~${(LOCAL_MODELS[id].bytes / 1e9).toFixed(1)} GB.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () =>
          deleteLocalModel(id)
            .catch((e) => Alert.alert('No pude borrarlo', friendlyError(e)))
            .finally(cargar),
      },
    ]);
  }

  async function usar(id: LocalModelId) {
    setPrefs(await setAiPrefs({ modeloLocal: id }));
    await releaseLocal();
    warmUpLocal();
  }

  async function cambiarPrivacidad(v: boolean) {
    setPrefs(await setAiPrefs({ privacidadEstricta: v }));
  }

  const probar = useCallback(async (privado: boolean) => {
    setProbando(true);
    setPrueba(null);
    const inicio = Date.now();
    let primero: number | null = null;
    try {
      const ruta = await planRoute(privado);
      const { text, source } = await askAi(
        [{ role: 'user', content: 'Responde en una frase corta: ¿qué es un presupuesto mensual?' }],
        {
          privado,
          maxTokens: 60,
          onPartial: (t, src) => {
            if (t && primero === null) primero = Date.now();
            setPrueba({ texto: t, info: `IA ${src}…` });
          },
        },
      );
      const total = ((Date.now() - inicio) / 1000).toFixed(1);
      const first = primero ? ` · primera palabra ${((primero - inicio) / 1000).toFixed(1)} s` : '';
      setPrueba({ texto: text, info: `IA ${source}${ruta.source && ruta.source !== source ? ' (respaldo)' : ''} · ${total} s total${first}` });
    } catch (e) {
      setPrueba({ texto: '', info: `Error: ${friendlyError(e)}` });
    } finally {
      setProbando(false);
    }
  }, []);

  function cerrarSesion() {
    Alert.alert('¿Cerrar sesión?', 'Tus datos se quedan cifrados en el celular.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
  }

  const estado = (ok: boolean, si: string, no: string) => <Badge label={ok ? si : no} color={ok ? p.success : p.danger} />;
  const activo = prefs && descargados ? (descargados.includes(prefs.modeloLocal) ? prefs.modeloLocal : descargados[0]) : undefined;

  return (
    <Screen module="ajustes" icon="cog-outline" title="Ajustes" subtitle="IA, cuenta y seguridad">
      <Card>
        <Row gap={14}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={{ width: 56, height: 56, borderRadius: 28 }} />
          ) : (
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.primarySoft }} />
          )}
          <View style={{ flex: 1 }}>
            <Body bold>{user?.name ?? 'Mi cuenta'}</Body>
            <Muted>{user?.email}</Muted>
          </View>
        </Row>
      </Card>

      <Card title="Velocidad y privacidad" icon="speedometer" accent={p.primary}>
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <Body bold>Privacidad estricta</Body>
            <Muted size={12}>
              {prefs?.privacidadEstricta
                ? 'Activada: plata y documentos solo se procesan en el celular (más lento).'
                : 'Desactivada: con internet, plata y documentos usan Gemini (respuestas en 1-3 s). Sin internet, la IA local.'}
            </Muted>
          </View>
          <Switch
            value={prefs?.privacidadEstricta ?? true}
            onValueChange={cambiarPrivacidad}
            trackColor={{ true: p.primary, false: p.backgroundSelected }}
            thumbColor="#FFFFFF"
          />
        </Row>
        <Muted size={12}>
          Lo común (registrar gastos, crear tareas, ver vencimientos) se resuelve al instante en código y nunca usa IA.
        </Muted>
      </Card>

      <Card title="IA local (sin internet)" icon="chip" accent={p.primary}>
        <Row>
          <Muted>Motor:</Muted>
          <Badge label={descargados?.length ? ESTADO_MOTOR[motor.status] : ESTADO_MOTOR['sin-modelo']} color={motor.status === 'lista' ? p.success : p.primary} />
        </Row>
        {motor.status === 'cargando' ? <Progress value={motor.progress} color={p.primary} /> : null}
        {descargados === null ? <ActivityIndicator /> : null}
        {(Object.keys(LOCAL_MODELS) as LocalModelId[]).map((id) => {
          const info = LOCAL_MODELS[id];
          const tiene = descargados?.includes(id) ?? false;
          const bajando = descarga?.id === id;
          return (
            <View key={id} style={{ gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: p.border }}>
              <Row>
                <View style={{ flex: 1 }}>
                  <Body bold>
                    {id === 'rapida' ? '⚡ Rápida' : '🎯 Precisa'} · {info.name.split(' ')[0]}
                  </Body>
                  <Muted size={12}>{info.descripcion}</Muted>
                </View>
                {tiene ? <Badge label={activo === id ? 'En uso' : 'Descargada'} color={activo === id ? p.success : p.primary} /> : null}
              </Row>
              {bajando ? (
                <>
                  <Progress value={descarga!.progreso} color={p.primary} height={10} />
                  <Row>
                    <Muted>Descargando… {Math.round(descarga!.progreso * 100)}% · no cierres la app</Muted>
                    <View style={{ flex: 1 }} />
                    <Button label="Cancelar" variant="ghost" onPress={() => cancelDownload()} />
                  </Row>
                </>
              ) : tiene ? (
                <Row gap={10}>
                  {activo !== id ? <Button label="Usar esta" icon="check" variant="secondary" style={{ flex: 1 }} onPress={() => usar(id)} /> : null}
                  <Button label="Borrar" icon="trash-can-outline" variant="danger" style={{ flex: 1 }} onPress={() => borrar(id)} />
                </Row>
              ) : (
                <Button label="Descargar" icon="download" variant={id === 'rapida' ? 'primary' : 'secondary'} disabled={!!descarga} onPress={() => descargar(id)} />
              )}
            </View>
          );
        })}
        {descargados?.length ? (
          <Button label="Despertar ahora" icon="lightning-bolt" variant="ghost" disabled={motor.status !== 'dormida'} onPress={() => warmUpLocal()} />
        ) : null}
      </Card>

      <Card title="IA en la nube (con internet)" icon="cloud-outline" accent={p.primary}>
        <Muted>
          {GEMINI_MODEL} · ligera: {GEMINI_FAST_MODEL} · plan gratis de Google
        </Muted>
        <Row>{estado(hasCloudKey(), 'Clave configurada', 'Falta la clave en el .env')}</Row>
        <Muted size={12}>Si la nube no responde en 12 s, la respuesta sigue con la IA local automáticamente.</Muted>
      </Card>

      <Card title="Probar la IA" icon="flask-outline" accent={p.primary}>
        <Row gap={10}>
          <Button label="Híbrida" icon="swap-horizontal" style={{ flex: 1 }} loading={probando} onPress={() => probar(false)} />
          <Button label="Dato privado" icon="cellphone-lock" variant="secondary" style={{ flex: 1 }} disabled={probando} onPress={() => probar(true)} />
        </Row>
        {prueba ? (
          <>
            {probando && prueba.texto ? <StreamingText text={prueba.texto} /> : prueba.texto ? <Body>{prueba.texto}</Body> : null}
            <Muted size={12}>{prueba.info}</Muted>
          </>
        ) : null}
      </Card>

      <Card title="Seguridad" icon="shield-lock-outline" accent={m.solid}>
        <ListItem icon="google" iconColor={accessToken ? p.success : p.warning} title="Google" subtitle={accessToken ? 'Conectado · solo lectura' : 'Desconectado · reconecta desde Hoy'} />
        <ListItem icon="database-lock-outline" iconColor={p.success} title="Base de datos cifrada" subtitle="SQLCipher con llave en el almacén seguro" />
        <ListItem icon="fingerprint" iconColor={p.success} title="Bloqueo con huella" subtitle="Al abrir y al volver de segundo plano" />
        <Button label="Cerrar sesión" icon="logout" variant="danger" onPress={cerrarSesion} />
      </Card>

      <Muted size={12}>Mi Vida · hecho por Abner con IA local + nube</Muted>
    </Screen>
  );
}
