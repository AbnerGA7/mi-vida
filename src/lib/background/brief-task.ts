import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { shouldRefreshBrief } from '@/lib/background/refresh';
import { BRIEF_HOUR, buildBrief, lastBriefRefresh, scheduleMorningBrief } from '@/lib/brief';
import { importantEmails, todayEvents, type Correo, type Evento } from '@/lib/google/api';
import { loadGoogleToken } from '@/lib/secure-store';

export const BRIEF_TASK = 'mi-vida-resumen-matutino';
const INTERVALO_MIN = 120;

// Corre sin pantalla: Android despierta la app, armo el resumen con mis datos locales y
// reprogramo la notificación de las 7 am. Así llega con las tareas del día correcto.
TaskManager.defineTask(BRIEF_TASK, async () => {
  try {
    if (!shouldRefreshBrief(new Date(), await lastBriefRefresh(), BRIEF_HOUR)) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    // Si el token de Google sigue vivo sumo la agenda y los correos; si no, sigo sin ellos.
    let eventos: Evento[] = [];
    let correos: Correo[] = [];
    const token = await loadGoogleToken().catch(() => null);
    if (token) {
      [eventos, correos] = await Promise.all([todayEvents(token), importantEmails(token)]).catch(() => [[], []] as [Evento[], Correo[]]);
    }
    const brief = await buildBrief(eventos, correos);
    await scheduleMorningBrief(brief, { pedirPermiso: false });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// Registro la tarea una sola vez; el sistema la recuerda aunque reinicie el celular.
export async function ensureBriefTask() {
  try {
    if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return false;
    if (!(await TaskManager.isTaskRegisteredAsync(BRIEF_TASK))) {
      await BackgroundTask.registerTaskAsync(BRIEF_TASK, { minimumInterval: INTERVALO_MIN });
    }
    return true;
  } catch {
    return false;
  }
}
