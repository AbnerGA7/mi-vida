import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Badge, Body, Button, Card, Empty, Input, ListItem, MicButton, Muted, Row, Screen, useModule, usePalette, type IconName } from '@/components/ui/kit';
import { prewarmLocal } from '@/lib/ai';
import { speak, stopSpeaking, useDictation } from '@/lib/voice';
import { daysUntil, formatFecha } from '@/lib/brain/dates';
import {
  extractFromStored,
  mimeFromPath,
  pickFile,
  processFile,
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

  const cargar = useCallback(async () => setDocs(await listDocuments()), []);

  useFocusEffect(
    useCallback(() => {
      cargar();
      // Cargo la IA local mientras miro la pantalla: así la primera pregunta no espera.
      prewarmLocal();
    }, [cargar]),
  );

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
      await saveDocument(await processFile(file, askCloud));
      await cargar();
    } catch (e) {
      Alert.alert('No pude guardar el documento', e instanceof Error ? e.message : String(e));
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
    if (!texto.trim()) return;
    setPensando(true);
    stopSpeaking();
    try {
      // Muestro la respuesta mientras la IA la escribe, sin esperar al final.
      const r = await askDocuments(texto, (parcial) => setRespuesta({ texto: parcial, fuentes: [], source: null }));
      setRespuesta(r);
      if (conVoz) speak(r.texto);
    } catch (e) {
      Alert.alert('No pude responder', e instanceof Error ? e.message : String(e));
    } finally {
      setPensando(false);
    }
  }

  async function releer(doc: Documento) {
    setProcesando(true);
    try {
      const nuevo = await extractFromStored(doc.nombre, doc.ruta, mimeFromPath(doc.ruta), askCloud);
      await updateDocumentContent(doc.id, nuevo);
      await cargar();
      Alert.alert(
        nuevo.texto.trim() ? 'Documento leído' : 'Sigo sin poder leerlo',
        nuevo.texto.trim()
          ? `${nuevo.categoria}${nuevo.fecha_vencimiento ? ` · vence el ${formatFecha(nuevo.fecha_vencimiento)}` : ''}`
          : 'Prueba escaneándolo con la cámara con buena luz.',
      );
    } catch (e) {
      Alert.alert('No pude leerlo', e instanceof Error ? e.message : String(e));
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
      { text: 'Borrar', style: 'destructive', onPress: () => deleteDocument(doc).then(cargar) },
    ]);
  }

  const alertas = docs.filter((d) => d.fecha_vencimiento && daysUntil(d.fecha_vencimiento) <= 30);

  return (
    <Screen module="cerebro" icon="brain" title="Segundo cerebro" subtitle={`${docs.length} documento(s) guardados`}>
      <Card title="Pregúntame" icon="chat-question-outline" accent={m.solid}>
        <Row>
          <View style={{ flex: 1 }}>
            <Input
              icon="magnify"
              value={escuchando ? parcial : pregunta}
              onChangeText={setPregunta}
              onSubmitEditing={() => preguntar()}
              placeholder={escuchando ? 'Te escucho…' : '¿Cuándo vence mi SOAT?'}
              returnKeyType="search"
            />
          </View>
          <MicButton escuchando={escuchando} color={m.solid} onPress={escuchando ? parar : empezar} />
        </Row>
        <Button label="Preguntar" icon="send" color={m.solid} loading={pensando} onPress={() => preguntar()} />
        {respuesta ? (
          <Card style={{ backgroundColor: m.soft, borderColor: 'transparent' }}>
            <Body>{respuesta.texto}</Body>
            {respuesta.fuentes.map((f, i) => (
              <Row key={f.id} gap={6}>
                <Badge label={`[${i + 1}]`} color={m.solid} />
                <Muted size={12}>{f.nombre}</Muted>
              </Row>
            ))}
            {respuesta.source === 'reglas' ? (
              <Muted size={12}>⚡ Respondido al instante con tus datos guardados</Muted>
            ) : respuesta.source ? (
              <Muted size={12}>🔒 Respondido con IA {respuesta.source}</Muted>
            ) : null}
            <Row>
              <Button label="Escuchar" icon="volume-high" variant="ghost" color={m.solid} onPress={() => speak(respuesta.texto)} />
              <Button label="Callar" icon="volume-off" variant="ghost" color={m.solid} onPress={stopSpeaking} />
            </Row>
          </Card>
        ) : null}
      </Card>

      {alertas.length > 0 && (
        <Card title="Por vencer" icon="alert-outline" accent={p.warning}>
          {alertas.map((d) => {
            const v = vencimiento(d.fecha_vencimiento)!;
            return <ListItem key={d.id} icon="calendar-alert" iconColor={v.color} title={d.nombre} subtitle={v.texto} />;
          })}
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
          <Empty icon="file-document-outline" text="Escanea tu SOAT, DNI, contrato de alquiler o póliza para empezar." />
        ) : (
          docs.map((d) => {
            const v = vencimiento(d.fecha_vencimiento);
            return (
              <ListItem
                key={d.id}
                icon={ICONO_DOC[d.categoria] ?? 'file-outline'}
                iconColor={m.solid}
                title={d.nombre}
                subtitle={`${d.categoria}${d.resumen && d.resumen !== d.nombre ? ` · ${d.resumen}` : ''}`}
                right={
                  v ? (
                    <Badge label={v.texto.replace('Vence el ', '')} color={v.color} />
                  ) : !d.texto?.trim() ? (
                    <Badge label="Sin leer" color={p.warning} />
                  ) : undefined
                }
                onPress={() => opciones(d)}
                onLongPress={() => borrar(d)}
              />
            );
          })
        )}
        {docs.length > 0 ? <Muted size={12}>Toca un documento para verlo o volver a leerlo · mantén presionado para borrar</Muted> : null}
      </Card>
    </Screen>
  );
}
