// Respuestas sin IA para las preguntas de siempre ("¿cuándo vence mi SOAT?"): salen al instante,
// sin descargar nada y con la fecha exacta guardada, así que no hay riesgo de que la IA la invente.

import { TIPOS, classifyByRules, normalize, tipoDesdePregunta } from '@/lib/brain/classify';
import { daysUntil, formatFecha } from '@/lib/brain/dates';

export type DocLite = {
  id: number;
  nombre: string;
  categoria: string;
  resumen: string | null;
  texto: string | null;
  fecha_vencimiento: string | null;
};

export type Intent = 'vencimiento' | 'vigente' | 'por_vencer' | 'listar';

export function detectIntent(pregunta: string): Intent | null {
  const q = normalize(pregunta).replace(/[¿?¡!.,]/g, ' ');
  if (/\b(esta|sigue|estara|es)\s+(vigente|valid[oa]|activ[oa]|vencid[oa])|ya\s+(se\s+)?(vencio|caduco|expiro)|\b(vencio|caduco)\b/.test(q)) return 'vigente';
  if (/cuando\s+(se\s+)?(vence|vencen|caduca|expira|termina|acaba)|hasta\s+cuando|fecha\s+de\s+(vencimiento|caducidad|expiracion)|cuando\s+(lo\s+|la\s+)?(tengo\s+que|hay\s+que|debo)\s+renovar|vencimiento|vigencia/.test(q)) return 'vencimiento';
  if (/(que|cuales|algo|algun\w*|tengo)\b.{0,30}\b(vence|vencen|vencid\w*|por\s+vencer|caduc\w*|renovar)/.test(q)) return 'por_vencer';
  if (/(que|cuales|cuantos)\s+documentos\s+(tengo|hay|guarde)|mis\s+documentos|lista\w*\s+(de\s+)?documentos/.test(q)) return 'listar';
  return null;
}

function tipoDe(d: DocLite) {
  return classifyByRules(d.nombre, `${d.resumen ?? ''}\n${d.texto ?? ''}`).tipo;
}

// Documentos de un tipo: por lo que detectan las reglas o porque el nombre/resumen lo dice.
export function docsDeTipo<T extends DocLite>(tipo: string, docs: T[]) {
  const alias = TIPOS.find((t) => t.tipo === tipo)?.alias ?? [];
  const claves = [normalize(tipo), ...alias];
  return docs.filter((d) => {
    const etiqueta = normalize(`${d.nombre} ${d.resumen ?? ''}`);
    return tipoDe(d) === tipo || claves.some((a) => etiqueta.includes(a));
  });
}

export function frasePlazo(fecha: string, today = new Date()) {
  const dias = daysUntil(fecha, today);
  const cuando = formatFecha(fecha);
  if (dias < 0) return `venció el ${cuando} (hace ${-dias === 1 ? '1 día' : `${-dias} días`})`;
  if (dias === 0) return `vence hoy, ${cuando}`;
  if (dias === 1) return `vence mañana, ${cuando}`;
  return `vence el ${cuando}, en ${dias} días`;
}

export type FastAnswer<T extends DocLite> = { texto: string; fuentes: T[] };

export function fastAnswer<T extends DocLite>(pregunta: string, docs: T[], today = new Date()): FastAnswer<T> | null {
  const intent = detectIntent(pregunta);
  if (!intent) return null;
  const tipo = tipoDesdePregunta(pregunta);

  if ((intent === 'vencimiento' || intent === 'vigente') && tipo) {
    const delTipo = docsDeTipo(tipo, docs);
    if (delTipo.length === 0) {
      return { texto: `No tengo tu ${tipo} guardado. Escanéalo y te aviso antes de que venza.`, fuentes: [] };
    }
    // El más nuevo primero: si renové el SOAT, me importa el vigente, no el del año pasado.
    const ordenados = [...delTipo].sort((a, b) => (b.fecha_vencimiento ?? '').localeCompare(a.fecha_vencimiento ?? ''));
    const conFecha = ordenados.filter((d) => d.fecha_vencimiento);
    if (conFecha.length === 0) {
      return {
        texto: `Tengo tu ${tipo}, pero no encontré su fecha de vencimiento. Ábrelo y revisa la parte de vigencia, o vuelve a escanearlo con buena luz.`,
        fuentes: ordenados.slice(0, 1),
      };
    }
    const principal = conFecha[0];
    const dias = daysUntil(principal.fecha_vencimiento!, today);
    let texto =
      intent === 'vigente'
        ? dias >= 0
          ? `Sí, tu ${tipo} está vigente: ${frasePlazo(principal.fecha_vencimiento!, today)}.`
          : `No, tu ${tipo} ${frasePlazo(principal.fecha_vencimiento!, today)}. Toca renovarlo.`
        : `Tu ${tipo} ${frasePlazo(principal.fecha_vencimiento!, today)}.`;
    if (intent === 'vencimiento' && dias < 0) texto += ' Toca renovarlo.';
    else if (intent === 'vencimiento' && dias <= 30) texto += ' Ve renovándolo.';
    // Si tengo más de uno vigente (por ejemplo, SOAT del carro y de la moto), los menciono.
    const otros = conFecha.slice(1).filter((d) => daysUntil(d.fecha_vencimiento!, today) >= 0);
    for (const d of otros.slice(0, 2)) texto += ` También tengo "${d.nombre}", que ${frasePlazo(d.fecha_vencimiento!, today)}.`;
    return { texto, fuentes: [principal, ...otros.slice(0, 2)] };
  }

  if (intent === 'por_vencer' || ((intent === 'vencimiento' || intent === 'vigente') && !tipo)) {
    const proximos = docs
      .filter((d) => d.fecha_vencimiento && daysUntil(d.fecha_vencimiento, today) <= 60)
      .sort((a, b) => a.fecha_vencimiento!.localeCompare(b.fecha_vencimiento!));
    if (proximos.length === 0) {
      const siguiente = docs
        .filter((d) => d.fecha_vencimiento)
        .sort((a, b) => a.fecha_vencimiento!.localeCompare(b.fecha_vencimiento!))[0];
      return {
        texto: siguiente
          ? `Nada vence en los próximos 2 meses. Lo siguiente es "${siguiente.nombre}", que ${frasePlazo(siguiente.fecha_vencimiento!, today)}.`
          : 'Ninguno de tus documentos tiene fecha de vencimiento guardada.',
        fuentes: siguiente ? [siguiente] : [],
      };
    }
    const lineas = proximos.slice(0, 4).map((d) => `"${d.nombre}" ${frasePlazo(d.fecha_vencimiento!, today)}`);
    const extra = proximos.length > 4 ? ` y ${proximos.length - 4} más` : '';
    return { texto: `${lineas.join('; ')}${extra}.`, fuentes: proximos.slice(0, 4) };
  }

  if (intent === 'listar') {
    if (docs.length === 0) return { texto: 'Todavía no tienes documentos. Escanea tu SOAT, DNI o un contrato para empezar.', fuentes: [] };
    const porCategoria = new Map<string, number>();
    for (const d of docs) porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + 1);
    const partes = [...porCategoria].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${n} de ${c}`);
    return { texto: `Tienes ${docs.length} documento${docs.length === 1 ? '' : 's'}: ${partes.join(', ')}.`, fuentes: [] };
  }
  return null;
}

// --- Búsqueda para cuando sí necesito a la IA ---

const STOPWORDS = new Set(
  'que cual cuales cuando como donde quien cuanto cuanta cuantos para por con sin del las los una uno unos unas mis tus sus este esta esto ese esa eso hay tiene tengo tienes dime decir sabes puedes quiero saber cual era fue son ser estar esta mio mia'.split(' '),
);

// Para que "¿cuánto pago de alquiler?" también encuentre "merced conductiva" o "arrendamiento".
const SINONIMOS: Record<string, string[]> = {
  soat: ['soat', 'accidentes'],
  brevete: ['brevete', 'licencia'],
  licencia: ['licencia', 'brevete'],
  alquiler: ['alquiler', 'arrendamiento', 'merced'],
  renta: ['renta', 'alquiler', 'arrendamiento'],
  sueldo: ['sueldo', 'remuneracion', 'neto'],
  seguro: ['seguro', 'poliza'],
  poliza: ['poliza', 'seguro'],
  placa: ['placa'],
  carro: ['vehiculo', 'placa'],
  auto: ['vehiculo', 'placa'],
  moto: ['vehiculo', 'placa', 'moto'],
  luz: ['luz', 'energia', 'kwh'],
  vence: ['vence', 'vencimiento', 'vigencia', 'hasta', 'caducidad'],
  vencimiento: ['vencimiento', 'vigencia', 'hasta', 'caducidad'],
};

export function palabrasClave(pregunta: string) {
  const palabras = normalize(pregunta).match(/[a-z0-9]{3,}/g) ?? [];
  const out = new Set<string>();
  for (const p of palabras) {
    if (STOPWORDS.has(p)) continue;
    for (const s of SINONIMOS[p] ?? [p]) out.add(s);
  }
  return [...out];
}

export function toFtsQuery(pregunta: string) {
  return palabrasClave(pregunta)
    .map((p) => `"${p}"*`)
    .join(' OR ');
}
