// Asistente central: un chat que entiende mis 4 módulos.
// 1. Acciones comunes (registrar gasto, crear tarea, vencimientos) se resuelven EN CÓDIGO: instantáneo.
// 2. Para lo demás armo un resumen compacto de mis datos y se lo paso a la IA (con streaming).
// 3. Si la privacidad estricta está activa, solo incluyo plata y documentos cuando la pregunta los necesita
//    (y en ese caso respondo con la IA local); lo general va a la nube y vuela.

import { askAi, type AiSource, type ChatMessage } from '@/lib/ai';
import { esRegistroDePlata, RE_DOCS, RE_PLATA, sinTildes, sinVerboDeGasto, textoDeTarea } from '@/lib/assistant/intent';
import { getAiPrefs } from '@/lib/ai/prefs';
import { daysUntil } from '@/lib/brain/dates';
import { askDocuments, listDocuments } from '@/lib/brain/repository';
import { getProfile } from '@/lib/coach/repository';
import { adaptToInjuries, buildRoutine, todaySession } from '@/lib/coach/routine';
import { formatSoles, summarizeBudgets } from '@/lib/finance/budget';
import { quickCapture } from '@/lib/finance/quick-capture';
import {
  addTransaction,
  deleteTransaction,
  listBudgets,
  listMonthTransactions,
  monthTotals,
  spentByCategory,
} from '@/lib/finance/repository';
import { horaCorta, todayEvents, type Evento } from '@/lib/google/api';
import { addTask, deleteTask, taskBucket, upcomingTasks } from '@/lib/tasks';

export type Accion =
  | { tipo: 'transaccion'; id: number; resumen: string }
  | { tipo: 'tarea'; id: number; resumen: string };

export type Mensaje = {
  id: string;
  rol: 'yo' | 'ia';
  texto: string;
  source?: AiSource | 'app';
  accion?: Accion;
  deshecho?: boolean;
  error?: boolean;
};

export type AssistantOptions = {
  accessToken?: string | null;
  onPartial?: (texto: string, source: AiSource) => void;
  signal?: AbortSignal;
};

async function registrarPlata(texto: string): Promise<Mensaje> {
  const mov = await quickCapture(sinVerboDeGasto(texto));
  const id = await addTransaction(mov);
  const resumen = `${mov.tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} de ${formatSoles(mov.monto)} · ${mov.categoria} · ${mov.cuenta}`;
  return {
    id: nuevoId(),
    rol: 'ia',
    texto: `✅ Listo, registré: ${resumen}.`,
    source: mov.conIa ? undefined : 'app',
    accion: { tipo: 'transaccion', id, resumen },
  };
}

async function crearTarea(texto: string): Promise<Mensaje | null> {
  const resto = textoDeTarea(texto);
  if (resto === null) return null;
  const t = await addTask(resto);
  if (!t) return null;
  const cuando = t.fecha_limite ? ` para el ${t.fecha_limite.split('-').reverse().join('/')}` : '';
  const resumen = `${t.prioridad === 'alta' ? '❗ ' : ''}${t.titulo}${cuando}`;
  return {
    id: nuevoId(),
    rol: 'ia',
    texto: `📝 Tarea creada: ${resumen}. La verás en Hoy.`,
    source: 'app',
    accion: { tipo: 'tarea', id: t.id, resumen },
  };
}

export async function deshacer(accion: Accion) {
  if (accion.tipo === 'transaccion') await deleteTransaction(accion.id);
  else await deleteTask(accion.id);
}

// ---------- Contexto con mis datos ----------

let eventosCache: { at: number; eventos: Evento[] } | null = null;

async function eventosDeHoy(token?: string | null) {
  if (!token) return [];
  if (eventosCache && Date.now() - eventosCache.at < 5 * 60000) return eventosCache.eventos;
  try {
    const eventos = await todayEvents(token);
    eventosCache = { at: Date.now(), eventos };
    return eventos;
  } catch {
    return eventosCache?.eventos ?? [];
  }
}

async function contextoGeneral(token?: string | null) {
  const [tareas, profile, eventos] = await Promise.all([
    upcomingTasks().catch(() => []),
    getProfile().catch(() => null),
    eventosDeHoy(token),
  ]);
  const ahora = new Date();
  const lineas = [
    `Fecha y hora: ${ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}.`,
  ];
  if (eventos.length) {
    lineas.push(
      `Agenda de hoy: ${eventos.map((e) => (e.todoElDia ? `${e.titulo} (todo el día)` : `${horaCorta(e.inicio)} ${e.titulo}`)).join('; ')}.`,
    );
  } else if (token) {
    lineas.push('Agenda de hoy: sin eventos.');
  }
  if (tareas.length) {
    lineas.push(
      `Tareas pendientes: ${tareas
        .slice(0, 10)
        .map((t) => `${t.titulo} [${taskBucket(t)}${t.fecha_limite ? ` ${t.fecha_limite}` : ''}${t.prioridad === 'alta' ? ', alta' : ''}]`)
        .join('; ')}.`,
    );
  } else {
    lineas.push('Tareas pendientes: ninguna.');
  }
  if (profile) {
    const sesion = todaySession(adaptToInjuries(buildRoutine(profile.dias_por_semana), profile.lesiones));
    lineas.push(
      `Coach: objetivo ${profile.objetivo}, ${profile.peso_kg} kg, ${profile.calorias} kcal/día (P ${profile.proteina_g} g, G ${profile.grasa_g} g, C ${profile.carbohidratos_g} g). ` +
        `Entreno de hoy: ${sesion.nombre} → ${sesion.ejercicios.map((e) => `${e.nombre} ${e.series}x${e.reps}`).join(', ')}.` +
        (profile.lesiones ? ` Lesiones: ${profile.lesiones}.` : ''),
    );
  }
  return lineas.join('\n');
}

async function contextoPlata() {
  const [totals, budgets, spent, movs] = await Promise.all([
    monthTotals(),
    listBudgets(),
    spentByCategory(),
    listMonthTransactions(),
  ]);
  const lineas = [
    `Plata del mes (cálculos ya hechos, úsalos tal cual): ingresos ${formatSoles(totals.ingresos)}, gastos ${formatSoles(totals.gastos)}, balance ${formatSoles(totals.ingresos - totals.gastos)}.`,
  ];
  const porCat = Object.entries(spent).sort((a, b) => b[1] - a[1]);
  if (porCat.length) lineas.push(`Gasto por categoría: ${porCat.map(([c, v]) => `${c} ${formatSoles(v)}`).join(', ')}.`);
  const res = summarizeBudgets(budgets, spent, new Date());
  if (res.length) {
    lineas.push(
      `Presupuestos: ${res
        .map((b) => `${b.categoria} ${formatSoles(b.gastado)}/${formatSoles(b.presupuesto)} (${b.estado.replace('_', ' ')}, proyección ${formatSoles(b.proyeccion)})`)
        .join('; ')}.`,
    );
  } else {
    lineas.push('Presupuestos: no hay ninguno definido.');
  }
  if (movs.length) {
    lineas.push(
      `Últimos movimientos: ${movs
        .slice(0, 8)
        .map((m) => `${m.fecha} ${m.tipo === 'ingreso' ? '+' : '-'}${formatSoles(m.monto)} ${m.descripcion} (${m.categoria})`)
        .join('; ')}.`,
    );
  }
  return lineas.join('\n');
}

async function contextoDocumentos() {
  const docs = await listDocuments();
  if (!docs.length) return 'Documentos: ninguno guardado.';
  return `Documentos guardados: ${docs
    .slice(0, 15)
    .map((d) => {
      const v = d.fecha_vencimiento ? `, vence ${d.fecha_vencimiento} (${daysUntil(d.fecha_vencimiento)} días)` : '';
      return `${d.nombre} [${d.categoria}${v}]`;
    })
    .join('; ')}.`;
}

const SYSTEM = `Eres "Mi Vida", el asistente personal de Abner en Perú. Hablas en español peruano, cercano y directo.
Reglas:
- Respuestas CORTAS: 1 a 5 líneas. Usa viñetas solo si ayudan.
- Usa SOLO los datos de "Mis datos". Si falta un dato, dilo y sugiere cómo registrarlo. Nunca inventes cifras.
- Los cálculos de plata ya vienen hechos: no los recalcules.
- Termina, cuando aplique, con UNA acción concreta que puedo hacer ahora.
- Puedo registrar cosas escribiéndote, por ejemplo: "gasté 20 en taxi con yape", "me pagaron 1500", "recuérdame pagar la luz el viernes!".
- Salud: si hay dolor agudo, mareo o síntomas serios, recomienda ir al médico. Nada de dietas extremas.
- Plata: puedes dar consejos de ahorro y presupuesto, pero no recomiendes inversiones específicas.`;

let contador = 0;
export function nuevoId() {
  contador += 1;
  return `${Date.now()}-${contador}`;
}

export async function runAssistant(texto: string, historial: Mensaje[], opts: AssistantOptions = {}): Promise<Mensaje> {
  const t = texto.trim();
  const s = sinTildes(t);

  // 1) Acciones en código: instantáneas, no gastan IA.
  const tarea = await crearTarea(t);
  if (tarea) return tarea;
  if (esRegistroDePlata(t)) return registrarPlata(t);

  // 2) Preguntas sobre un documento concreto → búsqueda en mis documentos con fuente.
  const pideDocs = RE_DOCS.test(s);
  if (pideDocs && /\?|cuando|cual|que|donde|numero|cuanto|hasta|tengo|dime/.test(s)) {
    const r = await askDocuments(t, { onPartial: opts.onPartial, signal: opts.signal });
    const fuentes = r.fuentes.length ? `\n\n📎 ${r.fuentes.map((f, i) => `[${i + 1}] ${f.nombre}`).join(' · ')}` : '';
    return { id: nuevoId(), rol: 'ia', texto: r.texto + fuentes, source: r.source === 'reglas' || !r.source ? 'app' : r.source };
  }

  // 3) Conversación con contexto.
  const prefs = await getAiPrefs();
  const pidePlata = RE_PLATA.test(s);

  // Con privacidad estricta solo agrego datos privados cuando la pregunta los necesita.
  // Sin privacidad estricta todo va a la nube de todas formas, así que le doy el panorama completo.
  const incluirPlata = pidePlata || !prefs.privacidadEstricta;
  const incluirDocs = pideDocs || !prefs.privacidadEstricta;

  const partes = await Promise.all([
    contextoGeneral(opts.accessToken),
    incluirPlata ? contextoPlata().catch(() => '') : Promise.resolve(''),
    incluirDocs ? contextoDocumentos().catch(() => '') : Promise.resolve(''),
  ]);
  const datos = partes.filter(Boolean).join('\n');
  const privado = incluirPlata || incluirDocs;

  const previos: ChatMessage[] = historial
    .filter((m) => !m.error && m.texto.trim())
    .slice(-6)
    .map((m) => ({ role: m.rol === 'yo' ? 'user' : 'assistant', content: m.texto.slice(0, 600) }));

  const { text, source } = await askAi(
    [
      { role: 'system', content: `${SYSTEM}\n\nMis datos:\n${datos}` },
      ...previos,
      { role: 'user', content: t },
    ],
    { privado, maxTokens: 450, temperature: 0.4, onPartial: opts.onPartial, signal: opts.signal },
  );
  return { id: nuevoId(), rol: 'ia', texto: text || 'No tengo una respuesta para eso todavía.', source };
}

export const SUGERENCIAS = [
  '¿Cómo voy con mi plata este mes?',
  '¿Qué tengo para hoy?',
  'Gasté 15 en taxi con yape',
  '¿Cuándo vence mi SOAT?',
  '¿Qué entreno hoy?',
  'Recuérdame pagar la luz el viernes!',
  'Dame un consejo para ahorrar',
  'Ayúdame a priorizar mi día',
];
