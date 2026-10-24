import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';

import { GoalsCard } from '@/components/finance/goals-card';
import { PaymentsCard } from '@/components/finance/payments-card';
import { Badge, Body, Button, Card, Chip, Divider, Display, Empty, Input, ListItem, MicButton, Muted, Notice, Overline, Progress, Row, Screen, Stat, useModule, usePalette, type IconName } from '@/components/ui/kit';
import { useLoader } from '@/hooks/use-loader';
import { friendlyError } from '@/lib/ai';
import { speak, useDictation } from '@/lib/voice';
import { Font, Spacing, Type } from '@/constants/theme';
import { formatSoles, summarizeBudgets, type CategoryBudget } from '@/lib/finance/budget';
import { quickCapture } from '@/lib/finance/quick-capture';
import { scanReceipt } from '@/lib/finance/receipt-scan';
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

const ICONO_CATEGORIA: Record<string, IconName> = {
  comida: 'food',
  transporte: 'bus',
  casa: 'home-outline',
  servicios: 'lightning-bolt-outline',
  salud: 'medical-bag',
  gym: 'dumbbell',
  estudios: 'school-outline',
  ocio: 'party-popper',
  ropa: 'tshirt-crew-outline',
  deudas: 'credit-card-outline',
  otros: 'dots-horizontal-circle-outline',
};

const ESTADO_LABEL = { ok: 'Vas bien', en_riesgo: 'En riesgo', excedido: 'Excedido' } as const;

export default function PlataScreen() {
  const p = usePalette();
  const m = useModule('plata');
  const [totals, setTotals] = useState({ ingresos: 0, gastos: 0 });
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [movs, setMovs] = useState<Transaction[]>([]);
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [catPresupuesto, setCatPresupuesto] = useState<string>(CATEGORIAS[0]);
  const [montoPresupuesto, setMontoPresupuesto] = useState('');
  const [ultimo, setUltimo] = useState<{ id: number; texto: string } | null>(null);
  const ocultar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { error, reload: cargar } = useLoader(async () => {
    const [t, b, s, mv] = await Promise.all([monthTotals(), listBudgets(), spentByCategory(), listMonthTransactions()]);
    setTotals(t);
    setBudgets(summarizeBudgets(b, s, new Date()));
    setMovs(mv);
  }, ['finanzas']);

  useEffect(() => () => {
    if (ocultar.current) clearTimeout(ocultar.current);
  }, []);

  const mostrarUltimo = useCallback((u: { id: number; texto: string }) => {
    setUltimo(u);
    if (ocultar.current) clearTimeout(ocultar.current);
    ocultar.current = setTimeout(() => setUltimo(null), 8000);
  }, []);

  // Si lo dicté, confirmo en voz alta lo que registré.
  const { escuchando, parcial, empezar, parar } = useDictation((dicho) => {
    setTexto(dicho);
    registrar(dicho, true);
  });

  async function registrar(entrada = texto, conVoz = false) {
    if (!entrada.trim()) return;
    if (guardando) return;
    setGuardando(true);
    try {
      const mov = await quickCapture(entrada);
      const id = await addTransaction(mov);
      setTexto('');
      mostrarUltimo({
        id,
        texto: `${mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} de ${formatSoles(mov.monto)} · ${mov.categoria} · ${mov.cuenta}`,
      });
      if (conVoz) {
        speak(`Listo, registré ${mov.tipo === 'ingreso' ? 'un ingreso de' : ''} ${mov.monto} soles en ${mov.categoria}.`);
      }
    } catch (e) {
      Alert.alert('No pude registrarlo', friendlyError(e) || 'Intenta con "25 menú con yape"');
    } finally {
      setGuardando(false);
    }
  }

  // Leo la boleta con la cámara y pido confirmación antes de guardar: el OCR puede equivocarse.
  async function escanearBoleta() {
    setGuardando(true);
    try {
      const mov = await scanReceipt();
      if (mov === 'cancelado') return;
      if (!mov) {
        Alert.alert('No encontré el total', 'Toma la foto de frente, con buena luz y que se vea la línea TOTAL.');
        return;
      }
      Alert.alert('¿Guardo este gasto?', `${mov.descripcion}\n${formatSoles(mov.monto)} · ${mov.categoria} · ${mov.fecha}`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Corregir', onPress: () => setTexto(`${mov.monto} ${mov.descripcion}`) },
        { text: 'Guardar', onPress: () => addTransaction(mov).then(cargar) },
      ]);
    } catch (e) {
      Alert.alert('No pude leer la boleta', e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPresupuesto() {
    const monto = Number(montoPresupuesto.replace(',', '.'));
    if (!Number.isFinite(monto) || monto <= 0) return;
    try {
      await setBudget(catPresupuesto, monto);
      setMontoPresupuesto('');
    } catch (e) {
      Alert.alert('No pude guardar el presupuesto', friendlyError(e));
    }
  }

  async function deshacerUltimo() {
    if (!ultimo) return;
    const { id } = ultimo;
    setUltimo(null);
    await deleteTransaction(id).catch((e) => Alert.alert('No pude deshacerlo', friendlyError(e)));
  }

  function borrar(t: Transaction) {
    Alert.alert('¿Borrar movimiento?', `${t.descripcion} · ${formatSoles(t.monto)}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          // Lo quito de la lista al toque; la base se actualiza detrás.
          setMovs((prev) => prev.filter((x) => x.id !== t.id));
          deleteTransaction(t.id).catch((e) => {
            Alert.alert('No pude borrarlo', friendlyError(e));
            cargar();
          });
        },
      },
    ]);
  }

  const balance = totals.ingresos - totals.gastos;
  const ESTADO_COLOR = { ok: p.success, en_riesgo: p.warning, excedido: p.danger };
  const mes = new Date().toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });

  const ahorro = totals.ingresos > 0 ? Math.max(0, balance) / totals.ingresos : 0;

  return (
    <Screen
      module="plata"
      icon="wallet-outline"
      eyebrow={mes}
      title="Mi plata"
      hero={
        <View style={{ gap: Spacing.three }}>
          <View style={{ gap: 2 }}>
            <Overline color="rgba(255,255,255,0.8)">Balance del mes</Overline>
            <Display color="#FFFFFF" size={44}>
              {formatSoles(balance)}
            </Display>
            {totals.ingresos > 0 ? (
              <Text style={[Type.caption, { color: 'rgba(255,255,255,0.85)' }]}>
                {balance >= 0 ? `Ahorras el ${Math.round(ahorro * 100)}% de lo que entra` : 'Este mes gastas más de lo que entra'}
              </Text>
            ) : null}
          </View>
          <Row gap={10}>
            <Stat tone="hero" label="Ingresos" value={formatSoles(totals.ingresos)} icon="arrow-down-circle-outline" />
            <Stat tone="hero" label="Gastos" value={formatSoles(totals.gastos)} icon="arrow-up-circle-outline" />
          </Row>
        </View>
      }>
      {error ? <Notice tone="danger" text={`No pude cargar tus datos: ${error}`} actionLabel="Reintentar" onAction={cargar} /> : null}
      <Card title="Registrar" subtitle="Escríbelo o dilo en voz alta" icon="lightning-bolt" accent={m.solid}>
        <Row>
          <View style={{ flex: 1 }}>
            <Input
              icon="message-text-outline"
              accent={m.solid}
              value={escuchando ? parcial : texto}
              onChangeText={setTexto}
              onSubmitEditing={() => registrar()}
              placeholder={escuchando ? 'Te escucho…' : '"25 menú con yape"'}
              returnKeyType="done"
            />
          </View>
          <MicButton escuchando={escuchando} color={m.solid} onPress={escuchando ? parar : empezar} />
        </Row>
        <Row>
          <Button label="Guardar movimiento" icon="check" color={m.solid} loading={guardando} onPress={() => registrar()} style={{ flex: 1 }} />
          <Button label="Boleta" icon="receipt-text-outline" variant="secondary" disabled={guardando} onPress={escanearBoleta} />
        </Row>
        <Muted size={12}>Lo entiendo al toque; si es raro, lo interpreta la IA local sin salir del celular.</Muted>
        {ultimo ? (
          <Notice tone="success" text={`Registrado: ${ultimo.texto}`} actionLabel="Deshacer" onAction={deshacerUltimo} />
        ) : null}
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {['10 pasaje', '15 menú yape', '50 mercado', 'me pagaron 1200'].map((ej) => (
            <Chip key={ej} label={ej} selected={false} color={m.solid} onPress={() => setTexto(ej)} />
          ))}
        </Row>
        <Muted size={12}>Lo común lo entiendo al instante sin IA; lo raro lo interpreta la IA.</Muted>
      </Card>

      <Card title="Presupuestos" subtitle="Semáforo según el avance del mes" icon="chart-donut" accent={m.solid}>
        {budgets.length === 0 ? (
          <Empty icon="chart-donut" color={m.solid} text="Aún no defines presupuestos. Elige una categoría abajo." />
        ) : (
          budgets.map((b) => (
            <View key={b.categoria} style={{ gap: Spacing.two }}>
              <ListItem
                icon={ICONO_CATEGORIA[b.categoria] ?? 'tag-outline'}
                iconColor={ESTADO_COLOR[b.estado]}
                title={b.categoria.charAt(0).toUpperCase() + b.categoria.slice(1)}
                subtitle={`${formatSoles(b.gastado)} de ${formatSoles(b.presupuesto)} · al cierre ${formatSoles(b.proyeccion)}`}
                right={<Badge label={ESTADO_LABEL[b.estado]} color={ESTADO_COLOR[b.estado]} />}
              />
              <Progress value={b.porcentaje} color={ESTADO_COLOR[b.estado]} />
            </View>
          ))
        )}

        <Divider />
        <Overline>Nuevo presupuesto</Overline>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
          {CATEGORIAS.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              icon={ICONO_CATEGORIA[cat]}
              selected={cat === catPresupuesto}
              color={m.solid}
              onPress={() => setCatPresupuesto(cat)}
            />
          ))}
        </ScrollView>
        <Row>
          <View style={{ flex: 1 }}>
            <Input
              icon="cash"
              accent={m.solid}
              value={montoPresupuesto}
              onChangeText={setMontoPresupuesto}
              placeholder="Monto mensual S/"
              keyboardType="decimal-pad"
            />
          </View>
          <Button label="Fijar" icon="target" variant="secondary" onPress={guardarPresupuesto} />
        </Row>
      </Card>

      <PaymentsCard />

      <GoalsCard />

      <Card title="Movimientos del mes" icon="swap-vertical" accent={m.solid} right={<Badge label={String(movs.length)} color={m.solid} />}>
        {movs.length === 0 ? (
          <Empty icon="receipt" color={m.solid} text="Todavía no registras nada este mes." />
        ) : (
          movs.map((t) => (
            <ListItem
              key={t.id}
              icon={t.tipo === 'ingreso' ? 'arrow-down-bold-circle-outline' : ICONO_CATEGORIA[t.categoria] ?? 'tag-outline'}
              iconColor={t.tipo === 'ingreso' ? p.success : m.solid}
              title={t.descripcion}
              subtitle={`${t.fecha} · ${t.categoria} · ${t.cuenta}`}
              right={
                <Text style={[Type.bodyStrong, { fontFamily: Font.bold, color: t.tipo === 'ingreso' ? p.success : p.text }]}>
                  {t.tipo === 'ingreso' ? '+' : '−'}
                  {formatSoles(t.monto)}
                </Text>
              }
              onLongPress={() => borrar(t)}
            />
          ))
        )}
        {movs.length > 0 ? <Muted size={12}>Mantén presionado un movimiento para borrarlo</Muted> : null}
      </Card>
    </Screen>
  );
}
