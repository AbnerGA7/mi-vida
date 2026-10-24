import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Badge, Body, Button, Card, Divider, Empty, Icon, Input, ListItem, MicButton, Muted, Notice, Overline, Row, Screen, Stat, StreamingText, useModule, usePalette, type IconName } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { useLoader } from '@/hooks/use-loader';
import { AiCancelled, friendlyError, prewarmLocal, type AiSource } from '@/lib/ai';
import { emitDataChanged } from '@/lib/events';
import { speak, stopSpeaking, useDictation } from '@/lib/voice';
import { daysUntil, formatFecha } from '@/lib/brain/dates';
import { scheduleExpiryReminders } from '@/lib/brain/expiry-notifications';
import {
  classifyWithAi,
  extractFromStored,
  mimeFromPath,
  pickFile,
  processFileFast,
  scanWithCamera,
  type AskCloud,
  type PickedFile,
} from '@/lib/brain/extract';
import {
  askDocuments,
  deleteDocument,
  listDocuments,
  saveDocument,
  updateDocumentContent,
  updateDocumentMeta,
  type Answer,
  type Documento,
} from '@/lib/brain/repository';
import { openDocument } from '@/lib/brain/viewer';

// Antes de mandar un PDF a la nube siempre pregunto: por defecto todo se lee en el celular.
const askCloud: AskCloud = (nombre) =>
  new Promise((resolve) =>
    Alert.alert(
      'No pude leerlo bien en el celular',
      `"${nombre}" tiene letra muy chica o el escaneo está borroso. ¿Lo leo con la IA en la nube (Gemini)? El archivo se enviará a Google.`,
      [
        { text: 'No, dejarlo así', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sí, leer en la nube', onPress: () => resolve(true) },
      ],
    ),
  );

const ICONO_DOC: Record<string, IconName> = {
  Seguros: 'shield-check-outline',
  Contratos: 'file-sign',
  'Identidad y trámites': 'card-account-details-outline',
  Salud: 'heart-pulse',
  Vehículos: 'car-outline',
  Hogar: 'home-outline',
  'Finanzas e impuestos': 'bank-outline',
  Estudios: 'school-outline',
  'Notas personales': 'note-text-outline',
};

export default function CerebroScreen() {
  const p = usePalette();
  const m = useModule('cerebro');
  const [docs, setDocs] = useState<Documento[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [pregunta, setPregunta] = useState('');
  const [pensando, setPensando] = useState(false);
  const [respuesta, setRespuesta] = useState<Answer | null>(null);
  const [stream, setStream] = useState<{ texto: string; source: AiSource } | null>(null);
  const [clasificando, setClasificando] = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const { error, reload: cargar } = useLoader(async () => {
    const lista = await listDocuments();
    setDocs(lista);
    // Cada vez que cambian mis documentos actualizo los avisos de vencimiento.
    scheduleExpiryReminders(lista).catch(() => {});
  }, ['documentos']);

  useFocusEffect(
    useCallback(() => {
      // Cargo la IA local mientras miro la pantalla: así la primera pregunta no espera.
      prewarmLocal();
    }, []),
  );

  // La IA mejora categoría y resumen en segundo plano; la lista ya muestra el documento.
  async function mejorarConIa(id: number, nombre: string, texto: string) {
    setClasificando((prev) => new Set(prev).add(id));
    try {
      const { categoria, resumen } = await classifyWithAi(nombre, texto);
      await updateDocumentMeta(id, categoria, resumen);
      emitDataChanged('documentos');
    } catch {
      // sin IA disponible: queda la categoría por palabras clave
    } finally {
      setClasificando((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function vencimiento(fecha: string | null) {
    if (!fecha) return null;
    const dias = daysUntil(fecha);
    if (dias < 0) return { texto: `Venció hace ${-dias} días`, color: p.danger };
    if (dias === 0) return { texto: 'Vence hoy', color: p.danger };
    if (dias <= 30) return { texto: `Vence en ${dias} días`, color: p.warning };
    return { texto: `Vence el ${fecha.split('-').reverse().join('/')}`, color: p.textSecondary };
  }

  async function agregar(obtener: () => Promise<PickedFile | null>) {
    try {
      const file = await obtener();
      if (!file) return;
      if (docs.some((d) => d.nombre === file.nombre)) {
        const seguir = await new Promise<boolean>((resolve) =>
          Alert.alert('Ya tienes este documento', `"${file.nombre}" ya está guardado. ¿Agregarlo otra vez?`, [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Agregar', onPress: () => resolve(true) },
          ]),
        );
        if (!seguir) return;
      }
      setProcesando(true);
      const doc = await processFileFast(file, askCloud);
      const id = await saveDocument(doc);
      emitDataChanged('documentos');
      setProcesando(false);
      if (doc.pendienteIa) mejorarConIa(id, doc.nombre, doc.texto);
    } catch (e) {
      Alert.alert('No pude guardar el documento', friendlyError(e));
    } finally {
      setProcesando(false);
    }
  }

  // Si pregunté hablando, también respondo hablando.
  const { escuchando, parcial, empezar, parar } = useDictation((texto) => {
    setPregunta(texto);
    preguntar(texto, true);
  });

  async function preguntar(texto = pregunta, conVoz = false) {
    if (!texto.trim() || pensando) return;
    setPensando(true);
    stopSpeaking();
    setRespuesta(null);
    setStream(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await askDocuments(texto, {
        signal: ctrl.signal,
        onPartial: (t, source) => setStream({ texto: t, source }),
      });
      setRespuesta(r);
      if (conVoz) speak(r.texto);
    } catch (e) {
      if (!(e instanceof AiCancelled)) Alert.alert('No pude responder', friendlyError(e));
    } finally {
      abortRef.current = null;
      setStream(null);
      setPensando(false);
    }
  }

  async function releer(doc: Documento) {
    setProcesando(true);
    try {
      const nuevo = await extractFromStored(doc.nombre, doc.ruta, mimeFromPath(doc.ruta), askCloud);
      await updateDocumentContent(doc.id, nuevo);
      emitDataChanged('documentos');
      Alert.alert(
        nuevo.texto.trim() ? 'Documento leído' : 'Sigo sin poder leerlo',
        nuevo.texto.trim()
          ? `${nuevo.categoria}${nuevo.fecha_vencimiento ? ` · vence el ${formatFecha(nuevo.fecha_vencimiento)}` : ''}`
          : 'Prueba escaneándolo con la cámara con buena luz.',
      );
    } catch (e) {
      Alert.alert('No pude leerlo', friendlyError(e));
    } finally {
      setProcesando(false);
    }
  }

  function opciones(doc: Documento) {
    Alert.alert(doc.nombre, doc.resumen ?? doc.categoria, [
      { text: 'Ver documento', onPress: () => openDocument(doc.ruta).catch((e) => Alert.alert('No pude abrirlo', String(e))) },
      { text: 'Volver a leer', onPress: () => releer(doc) },
      { text: 'Borrar', style: 'destructive', onPress: () => borrar(doc) },
    ]);
  }

  function borrar(doc: Documento) {
    Alert.alert('¿Borrar documento?', doc.nombre, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          setDocs((prev) => prev.filter((d) => d.id !== doc.id));
          deleteDocument(doc)
            .catch((e) => Alert.alert('No pude borrarlo', friendlyError(e)))
            .finally(cargar);
        },
      },
    ]);
  }

  const alertas = docs.filter((d) => d.fecha_vencimiento && daysUntil(d.fecha_vencimiento) <= 30);
  const categorias = new Set(docs.map((d) => d.categoria)).size;

  return (
    <Screen
      module="cerebro"
      icon="brain"
      eyebrow="Segundo cerebro"
      title="Tus papeles, a la mano"
      subtitle="Escanea, guarda y pregunta. Todo se lee dentro del celular."
      hero={
        <Row gap={10}>
          <Stat tone="hero" label="Documentos" value={String(docs.length)} icon="file-document-multiple-outline" />
          <Stat tone="hero" label="Por vencer" value={String(alertas.length)} icon="calendar-alert" />
          <Stat tone="hero" label="Categorías" value={String(categorias)} icon="shape-outline" />
        </Row>
      }>
      {error ? <Notice tone="danger" text={`No pude cargar tus documentos: ${error}`} actionLabel="Reintentar" onAction={cargar} /> : null}
      <Card title="Pregúntame" subtitle="Respondo citando el documento" icon="chat-question-outline" accent={m.solid}>
        <Row>
          <View style={{ flex: 1 }}>
            <Input
              icon="magnify"
              accent={m.solid}
              value={escuchando ? parcial : pregunta}
              onChangeText={setPregunta}
              onSubmitEditing={() => preguntar()}
              placeholder={escuchando ? 'Te escucho…' : '¿Cuándo vence mi SOAT?'}
              returnKeyType="search"
            />
          </View>
          <MicButton escuchando={escuchando} color={m.solid} onPress={escuchando ? parar : empezar} />
        </Row>
        {pensando ? (
          <Button label="Detener" icon="stop" variant="danger" onPress={() => abortRef.current?.abort()} />
        ) : (
          <Button label="Preguntar" icon="send" color={m.solid} onPress={() => preguntar()} />
        )}
        {pensando ? (
          <Card style={{ backgroundColor: m.soft, borderColor: 'transparent' }}>
            {stream?.texto ? (
              <StreamingText text={stream.texto} color={m.solid} />
            ) : (
              <Row>
                <ActivityIndicator color={m.solid} />
                <Muted>{stream?.source === 'local' ? 'Buscando y pensando en el celular…' : 'Buscando en tus documentos…'}</Muted>
              </Row>
            )}
          </Card>
        ) : null}
        {respuesta ? (
          <Card variant="tinted" accent={m.solid}>
            <Row gap={6}>
              <Icon name="creation" size={16} color={m.solid} />
              <Overline color={m.solid}>Respuesta</Overline>
            </Row>
            <Body>{respuesta.texto}</Body>
            {respuesta.fuentes.length > 0 ? (
              <View style={{ gap: Spacing.one + 2 }}>
                {respuesta.fuentes.map((f, i) => (
                  <Row key={f.id} gap={6}>
                    <Badge label={`${i + 1}`} color={m.solid} />
                    <Muted size={12}>{f.nombre}</Muted>
                  </Row>
                ))}
              </View>
            ) : null}
            {respuesta.source ? (
              <Muted size={12}>
                {respuesta.source === 'local'
                  ? 'Respondido en el celular'
                  : respuesta.source === 'nube'
                    ? 'Respondido con la nube'
                    : 'Respondido al instante con tus datos guardados'}
              </Muted>
            ) : null}
            <Row>
              <Button label="Escuchar" icon="volume-high" variant="secondary" size="sm" onPress={() => speak(respuesta.texto)} />
              <Button label="Callar" icon="volume-off" variant="ghost" size="sm" color={m.solid} onPress={stopSpeaking} />
            </Row>
          </Card>
        ) : null}
      </Card>

      {alertas.length > 0 && (
        <Card title="Por vencer" subtitle="Vencidos o en menos de 30 días" icon="alert-outline" accent={p.warning} variant="tinted">
          {alertas.map((d) => {
            const v = vencimiento(d.fecha_vencimiento)!;
            return <ListItem key={d.id} icon="calendar-alert" iconColor={v.color} title={d.nombre} subtitle={v.texto} onPress={() => opciones(d)} />;
          })}
          <Muted size={12}>Te aviso con una notificación 30, 7 y 1 día antes de cada vencimiento.</Muted>
        </Card>
      )}

      <Row gap={10}>
        <Button label="Escanear" icon="camera-outline" color={m.solid} style={{ flex: 1 }} disabled={procesando} onPress={() => agregar(scanWithCamera)} />
        <Button label="Subir" icon="paperclip" variant="secondary" style={{ flex: 1 }} disabled={procesando} onPress={() => agregar(pickFile)} />
      </Row>
      {procesando ? (
        <Card variant="tinted" accent={m.solid}>
          <Row gap={12}>
            <ActivityIndicator color={m.solid} />
            <View style={{ flex: 1 }}>
              <Body bold>Leyendo y clasificando…</Body>
              <Muted size={12}>OCR y IA local, sin salir del celular</Muted>
            </View>
          </Row>
        </Card>
      ) : null}

      <Card title="Mis documentos" icon="folder-outline" accent={m.solid} right={<Badge label={String(docs.length)} color={m.solid} />}>
        {docs.length === 0 ? (
          <Empty icon="file-document-outline" color={m.solid} text="Escanea tu SOAT, DNI, contrato de alquiler o póliza para empezar." />
        ) : (
          docs.map((d, i) => {
            const v = vencimiento(d.fecha_vencimiento);
            return (
              <View key={d.id} style={{ gap: Spacing.two }}>
                {i > 0 ? <Divider /> : null}
                <ListItem
                  icon={ICONO_DOC[d.categoria] ?? 'file-outline'}
                  iconColor={m.solid}
                  title={d.nombre}
                  subtitle={`${d.categoria}${d.resumen && d.resumen !== d.nombre ? ` · ${d.resumen}` : ''}`}
                  right={
                    clasificando.has(d.id) ? (
                      <ActivityIndicator size="small" color={m.solid} />
                    ) : v ? (
                      <Badge label={v.texto.replace('Vence el ', '')} color={v.color} />
                    ) : !d.texto?.trim() ? (
                      <Badge label="Sin leer" color={p.warning} />
                    ) : undefined
                  }
                  onPress={() => opciones(d)}
                  onLongPress={() => borrar(d)}
                />
              </View>
            );
          })
        )}
        {docs.length > 0 ? <Muted size={12}>Toca un documento para verlo o volver a leerlo · mantén presionado para borrar</Muted> : null}
      </Card>
    </Screen>
  );
}
