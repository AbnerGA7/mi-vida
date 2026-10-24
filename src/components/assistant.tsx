// Botón flotante ✨ disponible en todas las pestañas: abre el chat del asistente central.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge, MicButton, usePalette } from '@/components/ui/kit';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { AiCancelled, friendlyError, planRoute, type AiSource } from '@/lib/ai';
import { localStatus, onLocalStatusChange, warmUpLocal, type LocalStatus } from '@/lib/ai/local';
import { getAiPrefs } from '@/lib/ai/prefs';
import { deshacer, nuevoId, runAssistant, SUGERENCIAS, type Mensaje } from '@/lib/assistant';
import { useSession } from '@/lib/session';
import { speak, stopSpeaking, useDictation } from '@/lib/voice';

const ACCENT = '#7C3AED';
const ACCENT_2 = '#0F766E';

// La conversación vive mientras la app esté abierta, aunque cierre el chat.
let memoria: Mensaje[] = [];

export function AssistantLauncher() {
  const [abierto, setAbierto] = useState(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(2600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <>
      <View pointerEvents="box-none" style={styles.fabWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.fabHalo,
            { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }) },
            { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] },
          ]}
        />
        <Pressable
          onPress={() => setAbierto(true)}
          accessibilityLabel="Abrir asistente"
          style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
          <LinearGradient colors={[ACCENT, ACCENT_2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
            <MaterialCommunityIcons name="creation" size={28} color="#FFFFFF" />
          </LinearGradient>
        </Pressable>
      </View>
      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)} statusBarTranslucent>
        <AssistantChat onClose={() => setAbierto(false)} />
      </Modal>
    </>
  );
}

function useLocalStatus() {
  const [s, setS] = useState(localStatus());
  useEffect(() => onLocalStatusChange(() => setS(localStatus())), []);
  return s;
}

function AssistantChat({ onClose }: { onClose: () => void }) {
  const p = usePalette();
  const { accessToken } = useSession();
  const [mensajes, setMensajesState] = useState<Mensaje[]>(memoria);
  const [texto, setTexto] = useState('');
  const [enCurso, setEnCurso] = useState(false);
  const [parcial, setParcial] = useState<{ texto: string; source: AiSource | null } | null>(null);
  const [ruta, setRuta] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const local = useLocalStatus();

  const setMensajes = useCallback((f: (prev: Mensaje[]) => Mensaje[]) => {
    setMensajesState((prev) => {
      const next = f(prev);
      memoria = next;
      return next;
    });
  }, []);

  // Muestro por dónde va a responder y, si va a usar la local, la precargo mientras escribo.
  useEffect(() => {
    let vivo = true;
    (async () => {
      const [general, privada, prefs] = await Promise.all([planRoute(false), planRoute(true), getAiPrefs()]);
      if (!vivo) return;
      const etiqueta = (r: typeof general) => (r.source === 'nube' ? 'Nube ⚡' : r.source === 'local' ? 'Local 🔒' : 'Sin IA');
      setRuta(
        general.source === privada.source || !prefs.privacidadEstricta
          ? etiqueta(general)
          : `${etiqueta(general)} · plata y docs: ${etiqueta(privada)}`,
      );
      if (privada.source === 'local' || general.source === 'local') warmUpLocal();
    })();
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [mensajes, parcial?.texto]);

  // Actualizo el texto que se va generando como mucho cada 50 ms para no trabar la UI.
  const pendiente = useRef<{ texto: string; source: AiSource } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPartial = useCallback((t: string, source: AiSource) => {
    pendiente.current = { texto: t, source };
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (pendiente.current) setParcial(pendiente.current);
    }, 50);
  }, []);

  const enviar = useCallback(
    async (entrada: string, conVoz = false) => {
      const t = entrada.trim();
      if (!t || enCurso) return;
      setTexto('');
      const yo: Mensaje = { id: nuevoId(), rol: 'yo', texto: t };
      const historial = memoria;
      setMensajes((prev) => [...prev, yo]);
      setEnCurso(true);
      setParcial({ texto: '', source: null });
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await runAssistant(t, historial, { accessToken, onPartial, signal: ctrl.signal });
        setMensajes((prev) => [...prev, r]);
        if (conVoz) speak(r.texto.replace(/📎.*$/s, ''));
      } catch (e) {
        if (e instanceof AiCancelled) {
          const loQueIba = pendiente.current?.texto?.trim();
          if (loQueIba) setMensajes((prev) => [...prev, { id: nuevoId(), rol: 'ia', texto: `${loQueIba} …`, source: pendiente.current?.source }]);
        } else {
          setMensajes((prev) => [...prev, { id: nuevoId(), rol: 'ia', texto: `⚠️ ${friendlyError(e)}`, error: true }]);
        }
      } finally {
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        pendiente.current = null;
        abortRef.current = null;
        setParcial(null);
        setEnCurso(false);
      }
    },
    [accessToken, enCurso, onPartial, setMensajes],
  );

  const { escuchando, parcial: dictado, empezar, parar } = useDictation((dicho) => enviar(dicho, true));

  async function onDeshacer(m: Mensaje) {
    if (!m.accion || m.deshecho) return;
    try {
      await deshacer(m.accion);
      setMensajes((prev) => prev.map((x) => (x.id === m.id ? { ...x, deshecho: true } : x)));
    } catch (e) {
      setMensajes((prev) => [...prev, { id: nuevoId(), rol: 'ia', texto: `⚠️ No pude deshacerlo: ${friendlyError(e)}`, error: true }]);
    }
  }

  function limpiar() {
    abortRef.current?.abort();
    stopSpeaking();
    setMensajes(() => []);
  }

  const vacio = mensajes.length === 0 && !parcial;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.background }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}>
        <LinearGradient colors={[ACCENT, ACCENT_2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="creation" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Asistente</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {statusLabel(local.status, local.progress) ?? (ruta || 'Conecta tus 4 módulos')}
            </Text>
          </View>
          {mensajes.length > 0 ? (
            <Pressable onPress={limpiar} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Nueva conversación">
              <MaterialCommunityIcons name="broom" size={22} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Cerrar">
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {vacio ? (
            <View style={styles.welcome}>
              <Text style={[styles.welcomeTitle, { color: p.text }]}>¿En qué te ayudo?</Text>
              <Text style={{ color: p.textSecondary, textAlign: 'center', lineHeight: 20 }}>
                Pregúntame por tu plata, tus documentos, tu día o tu entreno. También puedo registrar gastos y crear
                tareas al toque.
              </Text>
            </View>
          ) : null}

          {mensajes.map((m) => (
            <Bubble key={m.id} m={m} onUndo={() => onDeshacer(m)} />
          ))}

          {parcial ? (
            <View style={[styles.bubble, styles.bubbleIa, { backgroundColor: p.backgroundElement, borderColor: p.border }]}>
              {parcial.texto ? (
                <Text style={[styles.bubbleText, { color: p.text }]}>
                  {parcial.texto}
                  <Text style={{ color: ACCENT }}> ▍</Text>
                </Text>
              ) : (
                <ThinkingDots label={parcial.source === 'local' ? thinkingLocal(local.status) : 'Pensando'} />
              )}
            </View>
          ) : null}

          {!enCurso && (vacio || mensajes.length < 2) ? (
            <View style={styles.suggestions}>
              {SUGERENCIAS.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => enviar(s)}
                  style={({ pressed }) => [
                    styles.suggestion,
                    { borderColor: p.border, backgroundColor: pressed ? p.backgroundSelected : p.backgroundElement },
                  ]}>
                  <Text style={{ color: p.text, fontSize: 14 }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.inputBar, { borderTopColor: p.border, backgroundColor: p.backgroundElement }]}>
          <TextInput
            value={escuchando ? dictado : texto}
            onChangeText={setTexto}
            placeholder={escuchando ? 'Te escucho…' : 'Escribe o habla…'}
            placeholderTextColor={p.textSecondary}
            style={[styles.input, { color: p.text, backgroundColor: p.background, borderColor: p.border }]}
            multiline
            maxLength={800}
            onSubmitEditing={() => enviar(texto)}
            returnKeyType="send"
            submitBehavior="submit"
          />
          <MicButton escuchando={escuchando} color={ACCENT} onPress={escuchando ? parar : empezar} />
          {enCurso ? (
            <Pressable
              onPress={() => abortRef.current?.abort()}
              style={[styles.send, { backgroundColor: p.danger }]}
              accessibilityLabel="Detener">
              <MaterialCommunityIcons name="stop" size={22} color="#FFFFFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => enviar(texto)}
              disabled={!texto.trim()}
              style={[styles.send, { backgroundColor: texto.trim() ? ACCENT : p.backgroundSelected }]}
              accessibilityLabel="Enviar">
              <MaterialCommunityIcons name="send" size={20} color={texto.trim() ? '#FFFFFF' : p.textSecondary} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function statusLabel(s: LocalStatus, progress: number) {
  if (s === 'cargando') return `Despertando la IA local… ${Math.round(progress * 100)}%`;
  return null;
}

function thinkingLocal(s: LocalStatus) {
  return s === 'cargando' ? 'Despertando la IA local' : 'Pensando en el celular';
}

function Bubble({ m, onUndo }: { m: Mensaje; onUndo: () => void }) {
  const p = usePalette();
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [fade]);

  const yo = m.rol === 'yo';
  return (
    <Animated.View
      style={[
        styles.bubble,
        yo ? styles.bubbleYo : styles.bubbleIa,
        yo
          ? { backgroundColor: ACCENT, borderColor: ACCENT }
          : { backgroundColor: m.error ? p.danger + '14' : p.backgroundElement, borderColor: m.error ? p.danger + '55' : p.border },
        { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] },
      ]}>
      <Text selectable style={[styles.bubbleText, { color: yo ? '#FFFFFF' : p.text }, m.deshecho && styles.tachado]}>
        {m.texto}
      </Text>
      {!yo && !m.error ? (
        <View style={styles.bubbleFooter}>
          {m.source ? (
            <Badge
              label={m.source === 'nube' ? '⚡ nube' : m.source === 'local' ? '🔒 local' : '✓ al instante'}
              color={m.source === 'nube' ? '#2563EB' : m.source === 'local' ? ACCENT_2 : '#16A34A'}
            />
          ) : null}
          <View style={{ flex: 1 }} />
          {m.accion ? (
            <Pressable onPress={onUndo} disabled={m.deshecho} hitSlop={8} style={styles.footerBtn}>
              <MaterialCommunityIcons name={m.deshecho ? 'check' : 'undo-variant'} size={16} color={p.textSecondary} />
              <Text style={{ color: p.textSecondary, fontSize: 12 }}>{m.deshecho ? 'Deshecho' : 'Deshacer'}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => speak(m.texto.replace(/📎.*$/s, ''))} hitSlop={8} style={styles.footerBtn}>
              <MaterialCommunityIcons name="volume-high" size={16} color={p.textSecondary} />
            </Pressable>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

const DOT_OPACITY = [
  [1, 0.3, 0.3, 1],
  [0.3, 1, 0.3, 0.3],
  [0.3, 0.3, 1, 0.3],
];

function ThinkingDots({ label }: { label: string }) {
  const p = usePalette();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {DOT_OPACITY.map((out, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: ACCENT, opacity: v.interpolate({ inputRange: [0, 0.33, 0.66, 1], outputRange: out }) }]}
          />
        ))}
      </View>
      <Text style={{ color: p.textSecondary, fontSize: 13 }}>{label}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 18, bottom: BottomTabInset + 18, alignItems: 'center', justifyContent: 'center' },
  fabHalo: { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: ACCENT },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 14 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.88)', fontSize: 12, marginTop: 1 },
  headerBtn: { padding: 6 },
  list: { padding: Spacing.three, gap: 10, paddingBottom: Spacing.four },
  welcome: { alignItems: 'center', gap: 8, paddingVertical: Spacing.five, paddingHorizontal: Spacing.three },
  welcomeTitle: { fontSize: 22, fontWeight: '800' },
  bubble: { maxWidth: '88%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  bubbleYo: { alignSelf: 'flex-end', borderBottomRightRadius: 6 },
  bubbleIa: { alignSelf: 'flex-start', borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  tachado: { textDecorationLine: 'line-through', opacity: 0.6 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  suggestion: { borderRadius: 999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 16, maxHeight: 120 },
  send: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
