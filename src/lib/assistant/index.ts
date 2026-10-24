import { askAi } from '@/lib/ai';
import { routeQuestion, type Ruta } from '@/lib/assistant/router';
import { formatFecha } from '@/lib/brain/dates';
import { askDocuments } from '@/lib/brain/repository';
import { buildBrief } from '@/lib/brief';
import { getProfile } from '@/lib/coach/repository';
import { adaptToInjuries, buildRoutine, todaySession } from '@/lib/coach/routine';
import { formatSoles, summarizeBudgets } from '@/lib/finance/budget';
import { goalProgress } from '@/lib/finance/goals';
import { upcomingPayments } from '@/lib/finance/payments';
import { listBudgets, listGoals, listPayments, monthTotals, spentByCategory } from '@/lib/finance/repository';
import { taskBucket, upcomingTasks } from '@/lib/tasks';

export type Respuesta = { texto: string; modulo: Ruta['modulo'] | 'ia'; source: 'reglas' | 'local' | 'nube' | null };

async function plata(ruta: Extract<Ruta, { modulo: 'plata' }>): Promise<string> {
  if (ruta.tema === 'categoria' && ruta.categoria) {
    const gastado = (await spentByCategory())[ruta.categoria] ?? 0;
    return gastado > 0 ? `Este mes llevas ${formatSoles(gastado)} en ${ruta.categoria}.` : `Este mes no registras gastos en ${ruta.categoria}.`;
  }
  if (ruta.tema === 'metas') {
    const metas = await listGoals();
    if (metas.length === 0) return 'Todavía no tienes metas de ahorro. Créalas en Mi plata.';
    return metas
      .map((g) => {
        const p = goalProgress(g);
        return `${g.nombre}: ${formatSoles(g.ahorrado)} de ${formatSoles(g.meta)} (${Math.round(p.porcentaje * 100)}%)${p.cuotaMensual ? `, guarda ${formatSoles(p.cuotaMensual)} al mes` : ''}`;
      })
      .join('. ') + '.';
  }
  if (ruta.tema === 'pagos') {
    const proximos = upcomingPayments(await listPayments(), new Date(), 7);
    if (proximos.length === 0) return 'No tienes pagos fijos en los próximos 7 días.';
    return `Esta semana pagas: ${proximos.map((x) => `${x.nombre} ${formatSoles(x.monto)} el ${formatFecha(x.fecha, false)}`).join('; ')}.`;
  }
  if (ruta.tema === 'presupuestos') {
    const resumen = summarizeBudgets(await listBudgets(), await spentByCategory(), new Date());
    if (resumen.length === 0) return 'Aún no defines presupuestos.';
    const mal = resumen.filter((b) => b.estado !== 'ok');
    if (mal.length === 0) return `Vas bien en tus ${resumen.length} presupuestos.`;
    return `Ojo con ${mal.map((b) => `${b.categoria} (${formatSoles(b.gastado)} de ${formatSoles(b.presupuesto)})`).join(' y ')}.`;
  }
  const { ingresos, gastos } = await monthTotals();
  return `Este mes entraron ${formatSoles(ingresos)} y gastaste ${formatSoles(gastos)}: te quedan ${formatSoles(ingresos - gastos)}.`;
}

async function coach(tema: 'calorias' | 'rutina') {
  const perfil = await getProfile();
  if (!perfil) return 'Primero arma tu plan en la pestaña Coach.';
  if (tema === 'calorias') {
    return `Tu meta es ${perfil.calorias} kcal: ${perfil.proteina_g} g de proteína, ${perfil.grasa_g} g de grasa y ${perfil.carbohidratos_g} g de carbohidratos.`;
  }
  const sesion = todaySession(adaptToInjuries(buildRoutine(perfil.dias_por_semana), perfil.lesiones));
  return `Hoy toca ${sesion.nombre}: ${sesion.ejercicios.map((e) => e.nombre).join(', ')}.`;
}

async function tareas() {
  const lista = await upcomingTasks();
  if (lista.length === 0) return 'No tienes pendientes para los próximos días.';
  const urgentes = lista.filter((t) => ['vencida', 'hoy'].includes(taskBucket(t)));
  const primeras = (urgentes.length ? urgentes : lista).slice(0, 4).map((t) => t.titulo);
  return `${urgentes.length ? `Para hoy tienes ${urgentes.length}` : `Tienes ${lista.length} pendientes`}: ${primeras.join(', ')}.`;
}

// Lo de cada módulo se responde en código con mis datos; solo lo que no reconozco va a la IA local,
// con el resumen del día como contexto (nada sale del celular).
export async function askAssistant(pregunta: string): Promise<Respuesta> {
  const ruta = routeQuestion(pregunta);
  if (ruta?.modulo === 'plata') return { texto: await plata(ruta), modulo: 'plata', source: 'reglas' };
  if (ruta?.modulo === 'coach') return { texto: await coach(ruta.tema), modulo: 'coach', source: 'reglas' };
  if (ruta?.modulo === 'tareas') return { texto: await tareas(), modulo: 'tareas', source: 'reglas' };
  if (ruta?.modulo === 'cerebro') {
    const r = await askDocuments(pregunta);
    return { texto: r.texto, modulo: 'cerebro', source: r.source };
  }
  const brief = await buildBrief();
  const { text, source } = await askAi(
    [
      { role: 'system', content: 'Eres mi asistente personal. Responde en 1 o 2 frases cortas en español, usando solo el resumen de mi día. Si no está ahí, dime en qué pestaña de la app buscarlo (Hoy, Mi plata, Segundo cerebro, Coach).' },
      { role: 'user', content: `Resumen de hoy:\n${brief.titular}\n${brief.lineas.join('\n')}\n\nPregunta: ${pregunta}` },
    ],
    { privado: true, maxTokens: 120, temperature: 0.3 },
  );
  return { texto: text, modulo: 'ia', source };
}
