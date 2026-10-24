import * as Notifications from 'expo-notifications';

import { planPaymentReminders, type Payment } from '@/lib/finance/payments';

const TIPO = 'pago';
const MAX_AVISOS = 30;
let ultimaFirma = '';

// Igual que los vencimientos: borro los avisos de pago anteriores y programo los nuevos.
// Devuelve cuántos avisos programó, o -1 si los pagos no cambiaron.
export async function schedulePaymentReminders(pagos: Payment[]) {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;
  // La fecha va en la huella: al pasar un vencimiento toca programar el siguiente.
  const firma = `${new Date().toDateString()}|${pagos.map((p) => `${p.id}:${p.dia}:${p.monto}`).join('|')}`;
  if (firma === ultimaFirma) return -1;

  const programadas = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    programadas
      .filter((n) => n.content.data?.tipo === TIPO)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );

  const avisos = planPaymentReminders(pagos).slice(0, MAX_AVISOS);
  for (const a of avisos) {
    await Notifications.scheduleNotificationAsync({
      content: { title: a.titulo, body: a.texto, data: { tipo: TIPO, pagoId: a.pagoId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.cuando },
    });
  }
  ultimaFirma = firma;
  return avisos.length;
}
