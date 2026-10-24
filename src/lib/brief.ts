import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { listDocuments } from '@/lib/brain/repository';
import { composeBrief, type Brief } from '@/lib/brief-text';
import { getProfile } from '@/lib/coach/repository';
import { listBudgets, listPayments, spentByCategory } from '@/lib/finance/repository';
import type { Correo, Evento } from '@/lib/google/api';
import { upcomingTasks, type Tarea } from '@/lib/tasks';

export type { Brief } from '@/lib/brief-text';

export const BRIEF_HOUR = 7;
const NOTIF_KEY = 'brief_notification_id';
const NOTIF_CONTENT_KEY = 'brief_notification_content';
const LAST_REFRESH_KEY = 'brief_last_refresh';

// El resumen se arma en código con mis datos: nada sale del celular para escribirlo.
// Si ya tengo las tareas cargadas las paso para no volver a consultarlas.
export async function buildBrief(eventos: Evento[] = [], correos: Correo[] = [], pendientes?: Tarea[]): Promise<Brief> {
  const [tareas, budgets, spent, docs, profile, pagos] = await Promise.all([
    pendientes ?? upcomingTasks(),
    listBudgets(),
    spentByCategory(),
    listDocuments(),
    getProfile(),
    listPayments(),
  ]);

  return composeBrief({ eventos, correos, tareas, budgets, spent, docs, profile, pagos });
}

// Cuándo armé el último resumen (en la app o en segundo plano), para no recalcular de más.
export function lastBriefRefresh() {
  return SecureStore.getItemAsync(LAST_REFRESH_KEY);
}

// Programo la notificación diaria con el último resumen; se actualiza cada vez que abro la app
// y también en segundo plano, donde no puedo mostrar el diálogo de permiso.
export async function scheduleMorningBrief(brief: Brief, { pedirPermiso = true } = {}) {
  // Solo pido permiso si todavía no lo tengo (antes lo pedía cada vez que abría Hoy).
  const actual = await Notifications.getPermissionsAsync();
  const perm = actual.granted || !pedirPermiso ? actual : await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;
  await SecureStore.setItemAsync(LAST_REFRESH_KEY, new Date().toISOString());

  const content = {
    title: `☀️ Buenos días: ${brief.titular}`,
    body: brief.lineas.join('\n') || 'Abre Mi Vida para ver tu día.',
  };
  // Guardo solo la huella del texto: el almacén seguro tiene un límite de tamaño por valor.
  const firma = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(content));

  // Cada vez que vuelvo a la pestaña Hoy se recalcula el resumen: solo reprogramo si cambió.
  const [anterior, firmaAnterior] = await Promise.all([
    SecureStore.getItemAsync(NOTIF_KEY),
    SecureStore.getItemAsync(NOTIF_CONTENT_KEY),
  ]);
  if (anterior && firmaAnterior === firma) {
    const programadas = await Notifications.getAllScheduledNotificationsAsync();
    if (programadas.some((n) => n.identifier === anterior)) return true;
  }
  if (anterior) await Notifications.cancelScheduledNotificationAsync(anterior).catch(() => {});

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: BRIEF_HOUR, minute: 0 },
  });
  await Promise.all([SecureStore.setItemAsync(NOTIF_KEY, id), SecureStore.setItemAsync(NOTIF_CONTENT_KEY, firma)]);
  return true;
}

export async function sendBriefNow(brief: Brief) {
  await Notifications.scheduleNotificationAsync({
    content: { title: `☀️ ${brief.titular}`, body: brief.lineas.join('\n') },
    trigger: null,
  });
}
