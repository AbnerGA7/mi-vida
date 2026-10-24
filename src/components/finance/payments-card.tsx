import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, Divider, Empty, Input, ListItem, Muted, Overline, Row, useModule, usePalette } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { formatFecha } from '@/lib/brain/dates';
import { formatSoles } from '@/lib/finance/budget';
import { schedulePaymentReminders } from '@/lib/finance/payment-notifications';
import { upcomingPayments, type Payment } from '@/lib/finance/payments';
import { addPayment, deletePayment, listPayments } from '@/lib/finance/repository';

function cuando(dias: number) {
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  return `En ${dias} días`;
}

// Pagos fijos del mes con su próxima fecha; me avisa la víspera y el mismo día.
export function PaymentsCard() {
  const p = usePalette();
  const m = useModule('plata');
  const [pagos, setPagos] = useState<Payment[]>([]);
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [dia, setDia] = useState('');

  const cargar = useCallback(async () => {
    const lista = await listPayments();
    setPagos(lista);
    schedulePaymentReminders(lista).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function crear() {
    const valor = Number(monto.replace(/[^\d.,]/g, '').replace(',', '.'));
    const d = Number(dia);
    if (!nombre.trim() || !Number.isFinite(valor) || valor <= 0 || !Number.isInteger(d) || d < 1 || d > 31) {
      Alert.alert('Falta un dato', 'Pon el nombre, el monto y el día del mes en que vence (1 a 31).');
      return;
    }
    await addPayment(nombre.trim(), valor, d);
    setNombre('');
    setMonto('');
    setDia('');
    await cargar();
  }

  function borrar(pago: Payment) {
    Alert.alert('¿Borrar pago fijo?', `${pago.nombre} · ${formatSoles(pago.monto)}`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Borrar', style: 'destructive', onPress: () => deletePayment(pago.id).then(cargar) },
    ]);
  }

  // Todos con su próxima fecha (31 días cubre cualquier mes).
  const proximos = upcomingPayments(pagos, new Date(), 31);
  const semana = proximos.filter((x) => x.dias <= 7).reduce((s, x) => s + x.monto, 0);

  return (
    <Card
      title="Pagos fijos"
      subtitle="Te aviso la noche anterior y el mismo día"
      icon="calendar-clock"
      accent={m.solid}
      right={semana > 0 ? <Badge label={`${formatSoles(semana)} esta semana`} color={p.warning} /> : undefined}>
      {proximos.length === 0 ? (
        <Empty icon="calendar-check-outline" color={m.solid} text="Agrega el alquiler, la luz o la tarjeta y no se te pasa ninguno." />
      ) : (
        proximos.map((x, i) => (
          <View key={x.id} style={{ gap: Spacing.two }}>
            {i > 0 ? <Divider /> : null}
            <ListItem
              icon="cash-clock"
              iconColor={x.dias <= 1 ? p.danger : x.dias <= 7 ? p.warning : m.solid}
              title={x.nombre}
              subtitle={`${formatSoles(x.monto)} · ${formatFecha(x.fecha, false)}`}
              right={<Badge label={cuando(x.dias)} color={x.dias <= 1 ? p.danger : x.dias <= 7 ? p.warning : p.textSecondary} />}
              onLongPress={() => borrar(x)}
            />
          </View>
        ))
      )}
      <Divider />
      <Overline>Nuevo pago fijo</Overline>
      <Input icon="text" accent={m.solid} value={nombre} onChangeText={setNombre} placeholder="Alquiler, luz, tarjeta…" />
      <Row>
        <View style={{ flex: 1 }}>
          <Input icon="cash" accent={m.solid} value={monto} onChangeText={setMonto} placeholder="Monto S/" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input icon="calendar-today" accent={m.solid} value={dia} onChangeText={setDia} placeholder="Día (1-31)" keyboardType="number-pad" />
        </View>
      </Row>
      <Button label="Agregar pago" icon="plus" variant="secondary" onPress={crear} />
      <Muted size={12}>Mantén presionado un pago para borrarlo.</Muted>
    </Card>
  );
}
