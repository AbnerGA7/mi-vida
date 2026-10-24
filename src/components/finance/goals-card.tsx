import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, Divider, Empty, Input, ListItem, Muted, Overline, Progress, Row, useModule, usePalette } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { findDates, formatFecha } from '@/lib/brain/dates';
import { formatSoles } from '@/lib/finance/budget';
import { goalProgress, type SavingsGoal } from '@/lib/finance/goals';
import { addGoal, addToGoal, deleteGoal, listGoals } from '@/lib/finance/repository';

function leerMonto(texto: string) {
  const n = Number(texto.replace(/[^\d.,]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Metas de ahorro: cuánto llevo, cuánto falta y cuánto guardar al mes para llegar a tiempo.
export function GoalsCard() {
  const p = usePalette();
  const m = useModule('plata');
  const [metas, setMetas] = useState<SavingsGoal[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  const [abono, setAbono] = useState('');
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');

  const cargar = useCallback(async () => setMetas(await listGoals()), []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function crear() {
    const meta = leerMonto(monto);
    if (!nombre.trim() || !meta) {
      Alert.alert('Falta un dato', 'Ponle un nombre a la meta y el monto que quieres juntar.');
      return;
    }
    const objetivo = fecha.trim() ? (findDates(fecha)[0]?.fecha ?? null) : null;
    if (fecha.trim() && !objetivo) {
      Alert.alert('No entendí la fecha', 'Escríbela como 15/03/2027 o déjala vacía.');
      return;
    }
    await addGoal(nombre.trim(), meta, objetivo);
    setNombre('');
    setMonto('');
    setFecha('');
    await cargar();
  }

  async function mover(signo: 1 | -1) {
    const valor = leerMonto(abono);
    if (elegida === null || !valor) return;
    await addToGoal(elegida, signo * valor);
    setAbono('');
    await cargar();
  }

  function borrar(g: SavingsGoal) {
    Alert.alert('¿Borrar meta?', g.nombre, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => deleteGoal(g.id).then(cargar) },
    ]);
  }

  return (
    <Card title="Metas de ahorro" subtitle="Toca una meta para abonar" icon="piggy-bank-outline" accent={m.solid}>
      {metas.length === 0 ? (
        <Empty icon="piggy-bank-outline" color={m.solid} text="Crea una meta: un viaje, un fondo de emergencia o la cuota inicial." />
      ) : (
        metas.map((g, i) => {
          const pr = goalProgress(g);
          const detalle = pr.completa
            ? '¡Meta cumplida!'
            : pr.atrasada
              ? `Se pasó la fecha · faltan ${formatSoles(pr.faltante)}`
              : pr.cuotaMensual !== null
                ? `Guarda ${formatSoles(pr.cuotaMensual)} al mes hasta el ${formatFecha(g.fecha_objetivo!)}`
                : `Faltan ${formatSoles(pr.faltante)}`;
          return (
            <View key={g.id} style={{ gap: Spacing.two }}>
              {i > 0 ? <Divider /> : null}
              <ListItem
                icon={pr.completa ? 'check-decagram' : 'piggy-bank-outline'}
                iconColor={pr.completa ? p.success : pr.atrasada ? p.warning : m.solid}
                title={g.nombre}
                subtitle={`${formatSoles(g.ahorrado)} de ${formatSoles(g.meta)}`}
                right={<Badge label={`${Math.round(pr.porcentaje * 100)}%`} color={pr.completa ? p.success : m.solid} />}
                onPress={() => setElegida(elegida === g.id ? null : g.id)}
                onLongPress={() => borrar(g)}
              />
              <Progress value={pr.porcentaje} color={pr.completa ? p.success : m.solid} />
              <Muted size={12}>{detalle}</Muted>
              {elegida === g.id ? (
                <Row>
                  <View style={{ flex: 1 }}>
                    <Input icon="cash-plus" accent={m.solid} value={abono} onChangeText={setAbono} placeholder="Monto S/" keyboardType="decimal-pad" />
                  </View>
                  <Button label="Abonar" icon="plus" size="sm" color={m.solid} onPress={() => mover(1)} />
                  <Button label="Retirar" icon="minus" size="sm" variant="ghost" color={m.solid} onPress={() => mover(-1)} />
                </Row>
              ) : null}
            </View>
          );
        })
      )}
      <Divider />
      <Overline>Nueva meta</Overline>
      <Input icon="flag-outline" accent={m.solid} value={nombre} onChangeText={setNombre} placeholder="Viaje a Cusco" />
      <Row>
        <View style={{ flex: 1 }}>
          <Input icon="cash" accent={m.solid} value={monto} onChangeText={setMonto} placeholder="Meta S/" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input icon="calendar" accent={m.solid} value={fecha} onChangeText={setFecha} placeholder="Para el 15/03/2027" />
        </View>
      </Row>
      <Button label="Crear meta" icon="target" variant="secondary" onPress={crear} />
      <Muted size={12}>Mantén presionada una meta para borrarla.</Muted>
    </Card>
  );
}
