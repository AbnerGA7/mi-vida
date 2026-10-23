import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { Badge, Body, Button, Card, Empty, Input, ListItem, Muted, Row, Screen, useModule, usePalette, type IconName } from '@/components/ui/kit';
import { daysUntil } from '@/lib/brain/dates';
import { pickFile, processFile, scanWithCamera, type PickedFile } from '@/lib/brain/extract';
import { askDocuments, deleteDocument, listDocuments, saveDocument, type Answer, type Documento } from '@/lib/brain/repository';

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
    }, [cargar]),
  );

  function vencimiento(fecha: string | null) {
    if (!fecha) return null;
    const dias = daysUntil(fecha);
    if (dias < 0) return { texto: `Venció hace ${-dias} días`, color: p.danger };
    if (dias === 0) return { texto: 'Vence hoy', color: p.danger };
    if (dias <= 30) return { texto: `Vence en ${dias} días`, color: p.warning };
    return { texto: `Vence el ${fecha}`, color: p.textSecondary };
  }

  async function agregar(obtener: () => Promise<PickedFile | null>) {
    try {
      const file = await obtener();
      if (!file) return;
      setProcesando(true);
      await saveDocument(await processFile(file));
      await cargar();
    } catch (e) {
      Alert.alert('No pude guardar el documento', e instanceof Error ? e.message : String(e));
    } finally {
      setProcesando(false);
    }
  }

  async function preguntar() {
    if (!pregunta.trim()) return;
    setPensando(true);
    try {
      setRespuesta(await askDocuments(pregunta));
    } catch (e) {
      Alert.alert('No pude responder', e instanceof Error ? e.message : String(e));
    } finally {
      setPensando(false);
    }
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
        <Input
          icon="magnify"
          value={pregunta}
          onChangeText={setPregunta}
          onSubmitEditing={preguntar}
          placeholder="¿Cuándo vence mi SOAT?"
          returnKeyType="search"
        />
        <Button label="Preguntar" icon="send" color={m.solid} loading={pensando} onPress={preguntar} />
        {respuesta ? (
          <Card style={{ backgroundColor: m.soft, borderColor: 'transparent' }}>
            <Body>{respuesta.texto}</Body>
            {respuesta.fuentes.map((f, i) => (
              <Row key={f.id} gap={6}>
                <Badge label={`[${i + 1}]`} color={m.solid} />
                <Muted size={12}>{f.nombre}</Muted>
              </Row>
            ))}
            {respuesta.source ? <Muted size={12}>🔒 Respondido con IA {respuesta.source}</Muted> : null}
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
        <Button label="Escanear" icon="camera-outline" color={m.solid} style={{ flex: 1 }} onPress={() => agregar(scanWithCamera)} />
        <Button label="Subir" icon="paperclip" variant="secondary" style={{ flex: 1 }} onPress={() => agregar(pickFile)} />
      </Row>
      {procesando ? (
        <Row style={{ justifyContent: 'center' }}>
          <ActivityIndicator color={m.solid} />
          <Muted>Leyendo y clasificando…</Muted>
        </Row>
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
                right={v ? <Badge label={v.texto.replace('Vence el ', '')} color={v.color} /> : undefined}
                onLongPress={() => borrar(d)}
              />
            );
          })
        )}
        {docs.length > 0 ? <Muted size={12}>Mantén presionado un documento para borrarlo</Muted> : null}
      </Card>
    </Screen>
  );
}
