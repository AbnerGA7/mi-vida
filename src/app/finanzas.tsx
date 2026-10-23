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
import { formatSoles, summarizeBudgets, type CategoryBudget } from '@/lib/finance/budget';
import { quickCapture } from '@/lib/finance/quick-capture';
import {
  addTransaction,
  CATEGORIAS,
  deleteTransaction,
  listBudgets,
  listMonthTransactions,
  monthTotals,
  setBudget,
  spentByCategory,
  type Transaction,
} from '@/lib/finance/repository';

const ESTADO_COLOR = { ok: '#3A9D5D', en_riesgo: '#E8A317', excedido: '#D93025' } as const;
const ESTADO_LABEL = { ok: 'Vas bien', en_riesgo: 'En riesgo', excedido: 'Excedido' } as const;

export default function FinanzasScreen() {
  const c = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [totals, setTotals] = useState({ ingresos: 0, gastos: 0 });
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [movs, setMovs] = useState<Transaction[]>([]);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [catPresupuesto, setCatPresupuesto] = useState<string>(CATEGORIAS[0]);
  const [montoPresupuesto, setMontoPresupuesto] = useState('');

  const cargar = useCallback(async () => {
    const [t, b, s, m] = await Promise.all([monthTotals(), listBudgets(), spentByCategory(), listMonthTransactions()]);
    setTotals(t);
    setBudgets(summarizeBudgets(b, s, new Date()));
    setMovs(m);
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function registrar() {
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      await addTransaction(await quickCapture(texto));
      setTexto('');
      await cargar();
    } catch (e) {
      Alert.alert('No pude registrarlo', e instanceof Error ? e.message : 'Intenta con "25 menú con yape"');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPresupuesto() {
    const monto = Number(montoPresupuesto.replace(',', '.'));
    if (!Number.isFinite(monto) || monto <= 0) return;
    await setBudget(catPresupuesto, monto);
    setMontoPresupuesto('');
    await cargar();
  }

  function borrar(t: Transaction) {
    Alert.alert('¿Borrar movimiento?', `${t.descripcion} · ${formatSoles(t.monto)}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => deleteTransaction(t.id).then(cargar) },
    ]);
  }

  const balance = totals.ingresos - totals.gastos;
  const card = [styles.card, { backgroundColor: c.backgroundElement }];
  const input = [styles.input, { color: c.text, borderColor: c.backgroundSelected }];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>💰 Mi plata</Text>

        <View style={card}>
          <Text style={{ color: c.textSecondary }}>Balance del mes</Text>
          <Text style={[styles.big, { color: balance < 0 ? ESTADO_COLOR.excedido : c.text }]}>{formatSoles(balance)}</Text>
          <View style={styles.row}>
            <Text style={{ color: c.textSecondary }}>Ingresos {formatSoles(totals.ingresos)}</Text>
            <Text style={{ color: c.textSecondary }}>Gastos {formatSoles(totals.gastos)}</Text>
          </View>
        </View>

        <View style={card}>
          <Text style={[styles.h2, { color: c.text }]}>Registrar</Text>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            onSubmitEditing={registrar}
            placeholder='Ej. "25 menú con yape" o "me pagaron 1200"'
            placeholderTextColor={c.textSecondary}
            style={input}
            returnKeyType="done"
          />
          <Pressable onPress={registrar} disabled={guardando} style={[styles.button, { backgroundColor: c.text }]}>
            {guardando ? (
              <ActivityIndicator color={c.background} />
            ) : (
              <Text style={[styles.buttonLabel, { color: c.background }]}>Guardar</Text>
            )}
          </Pressable>
        </View>

        <View style={card}>
          <Text style={[styles.h2, { color: c.text }]}>Presupuestos</Text>
          {budgets.length === 0 && <Text style={{ color: c.textSecondary }}>Aún no defines presupuestos.</Text>}
          {budgets.map((b) => (
            <View key={b.categoria} style={styles.budget}>
              <View style={styles.row}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{b.categoria}</Text>
                <Text style={{ color: ESTADO_COLOR[b.estado] }}>{ESTADO_LABEL[b.estado]}</Text>
              </View>
              <View style={[styles.track, { backgroundColor: c.backgroundSelected }]}>
                <View
                  style={[
                    styles.bar,
                    { width: `${Math.min(b.porcentaje, 1) * 100}%`, backgroundColor: ESTADO_COLOR[b.estado] },
                  ]}
                />
              </View>
              <Text style={{ color: c.textSecondary, fontSize: 13 }}>
                {formatSoles(b.gastado)} de {formatSoles(b.presupuesto)} · al cierre: {formatSoles(b.proyeccion)}
              </Text>
            </View>
          ))}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIAS.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCatPresupuesto(cat)}
                style={[styles.chip, { backgroundColor: cat === catPresupuesto ? c.text : c.backgroundSelected }]}>
                <Text style={{ color: cat === catPresupuesto ? c.background : c.text }}>{cat}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.row}>
            <TextInput
              value={montoPresupuesto}
              onChangeText={setMontoPresupuesto}
              placeholder="Monto mensual S/"
              placeholderTextColor={c.textSecondary}
              keyboardType="decimal-pad"
              style={[input, { flex: 1 }]}
            />
            <Pressable onPress={guardarPresupuesto} style={[styles.button, { backgroundColor: c.text, marginLeft: Spacing.two }]}>
              <Text style={[styles.buttonLabel, { color: c.background }]}>Fijar</Text>
            </Pressable>
          </View>
        </View>

        <View style={card}>
          <Text style={[styles.h2, { color: c.text }]}>Movimientos del mes</Text>
          {movs.length === 0 && <Text style={{ color: c.textSecondary }}>Todavía no registras nada este mes.</Text>}
          {movs.map((t) => (
            <Pressable key={t.id} onLongPress={() => borrar(t)} style={styles.mov}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text }} numberOfLines={1}>{t.descripcion}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                  {t.fecha} · {t.categoria} · {t.cuenta}
                </Text>
              </View>
              <Text style={{ color: t.tipo === 'ingreso' ? ESTADO_COLOR.ok : c.text, fontWeight: '600' }}>
                {t.tipo === 'ingreso' ? '+' : '−'} {formatSoles(t.monto)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '600' },
  big: { fontSize: 34, fontWeight: '700' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16 },
  button: { borderRadius: 12, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  budget: { gap: Spacing.one, marginBottom: Spacing.two },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: 8, borderRadius: 4 },
  chips: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: { borderRadius: 999, paddingVertical: Spacing.one + 2, paddingHorizontal: Spacing.three },
  mov: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.two, gap: Spacing.two },
});
