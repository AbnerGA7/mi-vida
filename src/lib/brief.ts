import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

import { daysUntil } from '@/lib/brain/dates';
import { listDocuments } from '@/lib/brain/repository';
import { getProfile } from '@/lib/coach/repository';
import { adaptToInjuries, buildRoutine, todaySession } from '@/lib/coach/routine';
import { formatSoles, summarizeBudgets } from '@/lib/finance/budget';
import { listBudgets, spentByCategory } from '@/lib/finance/repository';
import { horaCorta, type Correo, type Evento } from '@/lib/google/api';
import { taskBucket, upcomingTasks } from '@/lib/tasks';

export const BRIEF_HOUR = 7;
const NOTIF_KEY = 'brief_notification_id';

export type Brief = { titular: string; lineas: string[] };

// El resumen se arma en código con mis datos: nada sale del celular para escribirlo.
export async function buildBrief(eventos: Evento[] = [], correos: Correo[] = []): Promise<Brief> {
  const [tareas, budgets, spent, docs, profile] = await Promise.all([
    upcomingTasks(),
    listBudgets(),
    spentByCategory(),
    listDocuments(),
    getProfile(),
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

  const anterior = await SecureStore.getItemAsync(NOTIF_KEY);
  if (anterior) await Notifications.cancelScheduledNotificationAsync(anterior).catch(() => {});

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `☀️ Buenos días: ${brief.titular}`,
      body: brief.lineas.join('\n') || 'Abre Mi Vida para ver tu día.',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: BRIEF_HOUR, minute: 0 },
  });
  await SecureStore.setItemAsync(NOTIF_KEY, id);
  return true;
}

export async function sendBriefNow(brief: Brief) {
  await Notifications.scheduleNotificationAsync({
    content: { title: `☀️ ${brief.titular}`, body: brief.lineas.join('\n') },
    trigger: null,
  });
}
