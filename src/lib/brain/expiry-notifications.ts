import * as Notifications from 'expo-notifications';

import { planExpiryReminders, type DocConVencimiento } from '@/lib/brain/reminders';

const TIPO = 'vencimiento';
// Android guarda un número limitado de alarmas por app: con los más próximos me basta.
const MAX_AVISOS = 40;

// Rehago los avisos desde cero cada vez: así un documento borrado o renovado no deja avisos viejos.
export async function scheduleExpiryReminders(docs: DocConVencimiento[]) {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return 0;

  const programadas = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    programadas
      .filter((n) => n.content.data?.tipo === TIPO)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );

  const avisos = planExpiryReminders(docs).slice(0, MAX_AVISOS);
  for (const a of avisos) {
    await Notifications.scheduleNotificationAsync({
      content: { title: a.titulo, body: a.texto, data: { tipo: TIPO, docId: a.docId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.cuando },
    });
  }
  return avisos.length;
}
