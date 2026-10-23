import NetInfo from '@react-native-community/netinfo';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Badge, Body, Button, Card, ListItem, Muted, Progress, Row, Screen, useModule, usePalette } from '@/components/ui/kit';
import { askAi } from '@/lib/ai';
import { hasCloudKey } from '@/lib/ai/cloud';
import { deleteLocalModel, downloadLocalModel, hasSpaceForModel, isLocalModelReady } from '@/lib/ai/local';
import { GEMINI_MODEL, LOCAL_MODEL } from '@/lib/config';
import { useSession } from '@/lib/session';

export default function AjustesScreen() {
  const p = usePalette();
  const m = useModule('ajustes');
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

  const estado = (ok: boolean, si: string, no: string) => <Badge label={ok ? si : no} color={ok ? p.success : p.danger} />;

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

      <Card title="IA local (sin internet)" icon="chip" accent={p.primary}>
        <Muted>{LOCAL_MODEL.name} · ~2 GB · corre dentro del celular</Muted>
        {listo === null ? <ActivityIndicator /> : null}
        {listo !== null && progreso === null ? (
          <Row>{estado(listo, 'Descargada y lista', 'No descargada')}</Row>
        ) : null}
        {progreso !== null ? (
          <>
            <Progress value={progreso} color={p.primary} height={10} />
            <Muted>Descargando… {Math.round(progreso * 100)}% · no cierres la app</Muted>
          </>
        ) : null}
        {listo === false && progreso === null ? <Button label="Descargar IA local" icon="download" onPress={descargar} /> : null}
        {listo ? <Button label="Borrar IA local" icon="trash-can-outline" variant="danger" onPress={borrar} /> : null}
      </Card>

      <Card title="IA en la nube (con internet)" icon="cloud-outline" accent={p.primary}>
        <Muted>{GEMINI_MODEL} · plan gratis de Google</Muted>
        <Row>{estado(hasCloudKey(), 'Clave configurada', 'Falta la clave en el .env')}</Row>
        <Muted size={12}>Finanzas y documentos siempre usan la IA local: esos datos nunca salen del celular.</Muted>
      </Card>

      <Card title="Probar la IA" icon="flask-outline" accent={p.primary}>
        <Row gap={10}>
          <Button label="Híbrida" icon="swap-horizontal" style={{ flex: 1 }} loading={probando} onPress={() => probar(false)} />
          <Button label="Solo local" icon="cellphone-lock" variant="secondary" style={{ flex: 1 }} disabled={probando} onPress={() => probar(true)} />
        </Row>
        {prueba ? <Body>{prueba}</Body> : null}
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
