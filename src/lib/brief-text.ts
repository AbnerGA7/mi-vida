// Texto del resumen del día armado en código con mis datos, sin módulos nativos para poder probarlo.
import type { Documento } from '@/lib/brain/repository';
import { daysUntil } from '@/lib/brain/dates';
import type { Profile } from '@/lib/coach/repository';
import { adaptToInjuries, buildRoutine, todaySession } from '@/lib/coach/routine';
import { formatSoles, summarizeBudgets, type MonthlyBudget, type SpentByCategory } from '@/lib/finance/budget';
import { upcomingPayments, type Payment } from '@/lib/finance/payments';
import { horaCorta, type Correo, type Evento } from '@/lib/google/api';
import { taskBucket, type Tarea } from '@/lib/task-parse';

export type Brief = { titular: string; lineas: string[] };

export type BriefInput = {
  eventos: Evento[];
  correos: Correo[];
  tareas: Tarea[];
  budgets: MonthlyBudget[];
  spent: SpentByCategory;
  docs: Pick<Documento, 'nombre' | 'fecha_vencimiento'>[];
  profile: Profile | null;
  pagos: Payment[];
};

export function composeBrief({ eventos, correos, tareas, budgets, spent, docs, profile, pagos }: BriefInput, now = new Date()): Brief {
  const lineas: string[] = [];
  const reuniones = eventos.filter((e) => !e.todoElDia);
  const urgentes = tareas.filter((t) => ['vencida', 'hoy'].includes(taskBucket(t, now)));
  const principal = urgentes.find((t) => t.prioridad === 'alta') ?? urgentes[0] ?? tareas[0];

  if (reuniones.length) {
    lineas.push(`📅 ${reuniones.map((e) => `${horaCorta(e.inicio)} ${e.titulo}`).join(' · ')}`);
  }
  const vencidas = tareas.filter((t) => taskBucket(t, now) === 'vencida').length;
  if (urgentes.length) {
    lineas.push(`✅ ${urgentes.length} tarea(s) para hoy${vencidas ? ` (${vencidas} vencida/s)` : ''}`);
  }
  if (correos.length) lineas.push(`📧 ${correos.length} correo(s) importante(s) sin leer`);

  const enRiesgo = summarizeBudgets(budgets, spent, now).filter((b) => b.estado !== 'ok');
  if (enRiesgo.length) {
    lineas.push(
      `💰 ${enRiesgo.map((b) => `${b.categoria}: ${formatSoles(b.gastado)} de ${formatSoles(b.presupuesto)}`).join(' · ')}`,
    );
  }

  const proximos = upcomingPayments(pagos, now, 3);
  if (proximos.length) {
    lineas.push(`💳 ${proximos.map((x) => `${x.nombre} ${formatSoles(x.monto)} (${x.dias === 0 ? 'hoy' : x.dias === 1 ? 'mañana' : `en ${x.dias} días`})`).join(' · ')}`);
  }

  const porVencer = docs.filter((d) => d.fecha_vencimiento && daysUntil(d.fecha_vencimiento, now) <= 7);
  if (porVencer.length) {
    lineas.push(`📄 ${porVencer.map((d) => `${d.nombre} (${daysUntil(d.fecha_vencimiento!, now)} días)`).join(' · ')}`);
  }

  if (profile) {
    const sesion = todaySession(adaptToInjuries(buildRoutine(profile.dias_por_semana), profile.lesiones), now);
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
