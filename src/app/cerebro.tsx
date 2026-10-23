import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import { daysUntil } from '@/lib/brain/dates';
import { pickFile, processFile, scanWithCamera, type PickedFile } from '@/lib/brain/extract';
import {
  askDocuments,
  deleteDocument,
  listDocuments,
  saveDocument,
  type Answer,
  type Documento,
} from '@/lib/brain/repository';

const ROJO = '#D93025';
const AMBAR = '#E8A317';

function vencimiento(fecha: string | null) {
  if (!fecha) return null;
  const dias = daysUntil(fecha);
  if (dias < 0) return { texto: `Venció hace ${-dias} días`, color: ROJO };
  if (dias === 0) return { texto: 'Vence hoy', color: ROJO };
  if (dias <= 30) return { texto: `Vence en ${dias} días`, color: AMBAR };
  return { texto: `Vence el ${fecha}`, color: undefined };
}

export default function CerebroScreen() {
  const c = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
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

  const card = [styles.card, { backgroundColor: c.backgroundElement }];
  const alertas = docs.filter((d) => d.fecha_vencimiento && daysUntil(d.fecha_vencimiento) <= 30);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>🧠 Segundo cerebro</Text>

        <View style={card}>
          <Text style={[styles.h2, { color: c.text }]}>Pregúntame</Text>
          <TextInput
            value={pregunta}
            onChangeText={setPregunta}
            onSubmitEditing={preguntar}
            placeholder="¿Cuándo vence mi SOAT?"
            placeholderTextColor={c.textSecondary}
            style={[styles.input, { color: c.text, borderColor: c.backgroundSelected }]}
            returnKeyType="search"
          />
          <Pressable onPress={preguntar} disabled={pensando} style={[styles.button, { backgroundColor: c.text }]}>
            {pensando ? (
              <ActivityIndicator color={c.background} />
            ) : (
              <Text style={[styles.buttonLabel, { color: c.background }]}>Preguntar</Text>
            )}
          </Pressable>
          {respuesta && (
            <View style={{ gap: Spacing.one }}>
              <Text style={{ color: c.text, fontSize: 16 }}>{respuesta.texto}</Text>
              {respuesta.fuentes.map((f, i) => (
                <Text key={f.id} style={{ color: c.textSecondary, fontSize: 12 }}>
                  [{i + 1}] {f.nombre}
                </Text>
              ))}
              {respuesta.source && (
                <Text style={{ color: c.textSecondary, fontSize: 12 }}>🔒 Respondido con IA {respuesta.source}</Text>
              )}
            </View>
          )}
        </View>

        {alertas.length > 0 && (
          <View style={[card, { borderColor: AMBAR, borderWidth: 1 }]}>
            <Text style={[styles.h2, { color: c.text }]}>⚠️ Por vencer</Text>
            {alertas.map((d) => (
              <Text key={d.id} style={{ color: vencimiento(d.fecha_vencimiento)?.color ?? c.text }}>
                {d.nombre}: {vencimiento(d.fecha_vencimiento)?.texto}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          <Pressable onPress={() => agregar(scanWithCamera)} style={[styles.button, styles.flex, { backgroundColor: c.text }]}>
            <Text style={[styles.buttonLabel, { color: c.background }]}>📷 Escanear</Text>
          </Pressable>
          <Pressable onPress={() => agregar(pickFile)} style={[styles.button, styles.flex, { backgroundColor: c.backgroundSelected }]}>
            <Text style={[styles.buttonLabel, { color: c.text }]}>📎 Subir archivo</Text>
          </Pressable>
        </View>
        {procesando && (
          <View style={styles.actions}>
            <ActivityIndicator />
            <Text style={{ color: c.textSecondary }}>Leyendo y clasificando…</Text>
          </View>
        )}

        <View style={card}>
          <Text style={[styles.h2, { color: c.text }]}>Mis documentos ({docs.length})</Text>
          {docs.length === 0 && (
            <Text style={{ color: c.textSecondary }}>Escanea tu SOAT, DNI, contrato de alquiler o póliza para empezar.</Text>
          )}
          {docs.map((d) => {
            const v = vencimiento(d.fecha_vencimiento);
            return (
              <Pressable key={d.id} onLongPress={() => borrar(d)} style={styles.doc}>
                <Text style={{ color: c.text, fontWeight: '600' }} numberOfLines={1}>{d.nombre}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 13 }} numberOfLines={2}>{d.resumen}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                  {d.categoria}
                  {v && <Text style={{ color: v.color ?? c.textSecondary }}> · {v.texto}</Text>}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '600' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  flex: { flex: 1 },
  doc: { paddingVertical: Spacing.two, gap: 2 },
});
