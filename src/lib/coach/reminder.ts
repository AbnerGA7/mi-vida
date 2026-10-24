import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const KEY = 'coach_weekly_reminder_id';
// Domingo (en expo-notifications 1 es domingo) a las 6 pm: cierro la semana con mi registro.
const DOMINGO = 1;
const HORA = 18;

// Programo una sola vez el recordatorio semanal; si ya existe no lo duplico.
export async function scheduleWeeklyCheckinReminder() {
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return false;

  const anterior = await SecureStore.getItemAsync(KEY);
  if (anterior) {
    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    if (programadas.some((n) => n.identifier === anterior)) return true;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '💪 Registro semanal del Coach',
      body: 'Anota tu peso promedio, energía y sueño: con eso ajusto tus calorías y tu rutina.',
      data: { tipo: 'coach_semanal' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: DOMINGO, hour: HORA, minute: 0 },
  });
  await SecureStore.setItemAsync(KEY, id);
  return true;
}
