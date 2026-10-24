import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { daysUntil } from '@/lib/brain/dates';
import { listDocuments } from '@/lib/brain/repository';
import { getProfile } from '@/lib/coach/repository';
import { adaptToInjuries, buildRoutine, todaySession } from '@/lib/coach/routine';
import { formatSoles, summarizeBudgets } from '@/lib/finance/budget';
import { upcomingPayments } from '@/lib/finance/payments';
import { listBudgets, listPayments, spentByCategory } from '@/lib/finance/repository';
import { horaCorta, type Correo, type Evento } from '@/lib/google/api';
import { taskBucket, upcomingTasks, type Tarea } from '@/lib/tasks';

export const BRIEF_HOUR = 7;
const NOTIF_KEY = 'brief_notification_id';
const NOTIF_CONTENT_KEY = 'brief_notification_content';

export type Brief = { titular: string; lineas: string[] };

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

  const lineas: string[] = [];
  const reuniones = eventos.filter((e) => !e.todoElDia);
  const urgentes = tareas.filter((t) => ['vencida', 'hoy'].includes(taskBucket(t)));
  const principal = urgentes.find((t) => t.prioridad === 'alta') ?? urgentes[0] ?? tareas[0];

  if (reuniones.length) {
    lineas.push(`📅 ${reuniones.map((e) => `${horaCorta(e.inicio)} ${e.titulo}`).join(' · ')}`);
  }
  const vencidas = tareas.filter((t) => taskBucket(t) === 'vencida').length;
  if (urgentes.length) {
    lineas.push(`✅ ${urgentes.length} tarea(s) para hoy${vencidas ? ` (${vencidas} vencida/s)` : ''}`);
  }
  if (correos.length) lineas.push(`📧 ${correos.length} correo(s) importante(s) sin leer`);

  const enRiesgo = summarizeBudgets(budgets, spent, new Date()).filter((b) => b.estado !== 'ok');
  if (enRiesgo.length) {
    lineas.push(
      `💰 ${enRiesgo.map((b) => `${b.categoria}: ${formatSoles(b.gastado)} de ${formatSoles(b.presupuesto)}`).join(' · ')}`,
    );
  }

  const proximos = upcomingPayments(pagos, new Date(), 3);
  if (proximos.length) {
    lineas.push(`💳 ${proximos.map((x) => `${x.nombre} ${formatSoles(x.monto)} (${x.dias === 0 ? 'hoy' : x.dias === 1 ? 'mañana' : `en ${x.dias} días`})`).join(' · ')}`);
  }

  const porVencer = docs.filter((d) => d.fecha_vencimiento && daysUntil(d.fecha_vencimiento) <= 7);
  if (porVencer.length) {
    lineas.push(`📄 ${porVencer.map((d) => `${d.nombre} (${daysUntil(d.fecha_vencimiento!)} días)`).join(' · ')}`);
  }

  if (profile) {
    const sesion = todaySession(adaptToInjuries(buildRoutine(profile.dias_por_semana), profile.lesiones));
    lineas.push(`💪 Gym: ${sesion.nombre} · ${profile.calorias} kcal / ${profile.proteina_g} g proteína`);
  }

  const titular =
    [
      reuniones.length ? `${reuniones.length} reunión(es)` : 'Sin reuniones',
      principal ? `lo más importante: ${principal.titulo}` : null,
    ]
      .filter(Boolean)
      .join(', ') + '.';

  return { titular, lineas };
}

// Programo la notificación diaria con el último resumen; se actualiza cada vez que abro la app.
export async function scheduleMorningBrief(brief: Brief) {
  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;

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
