// Clasificación de documentos en código: instantánea, sin internet y funciona aunque la IA local
// no esté descargada. La IA solo entra cuando las reglas no están seguras.

export const CATEGORIAS_DOC = [
  'Seguros',
  'Contratos',
  'Identidad y trámites',
  'Salud',
  'Vehículos',
  'Hogar',
  'Finanzas e impuestos',
  'Estudios',
  'Notas personales',
] as const;

export type CategoriaDoc = (typeof CATEGORIAS_DOC)[number];

type TipoDoc = {
  tipo: string;
  categoria: CategoriaDoc;
  // Cada patrón suma su peso si aparece en el texto (o en el nombre del archivo, que pesa doble).
  patrones: [RegExp, number][];
  // Palabras con las que lo nombro al preguntar ("¿cuándo vence mi brevete?").
  alias: string[];
  vigenciaAnios?: number;
  // Tipo genérico ("Contrato", "Póliza"): solo gana si ningún tipo específico está seguro.
  generico?: boolean;
};

// Ordenados de más específico a más general: en empate gana el primero.
export const TIPOS: TipoDoc[] = [
  {
    tipo: 'SOAT',
    categoria: 'Seguros',
    patrones: [[/\bs\s?[o0]\s?a\s?t\b/, 6], [/seguro obligatorio de accidentes de transito/, 6], [/\bafocat\b/, 5], [/certificado soat/, 4], [/accidentes de transito/, 2], [/\bplaca\b/, 1], [/\bclase.{0,20}vehicul/, 1]],
    alias: ['soat', 'seguro obligatorio', 'seguro del carro', 'seguro del auto', 'seguro de la moto', 'seguro vehicular'],
    vigenciaAnios: 1,
  },
  {
    tipo: 'Revisión técnica',
    categoria: 'Vehículos',
    patrones: [[/revision tecnica/, 6], [/inspeccion tecnica vehicular/, 6], [/\bcitv\b/, 4], [/certificado de inspeccion/, 3]],
    alias: ['revision tecnica', 'revision', 'inspeccion tecnica', 'citv'],
    vigenciaAnios: 1,
  },
  {
    tipo: 'Brevete',
    categoria: 'Vehículos',
    patrones: [[/licencia de conducir/, 6], [/\bbrevete\b/, 6], [/\bmtc\b/, 1], [/clase\s*a\s*(?:categoria|i{1,3}|[1-3])/, 3], [/\bb-?ii?[abc]?\b.{0,20}moto/, 2]],
    alias: ['brevete', 'licencia de conducir', 'licencia'],
  },
  {
    tipo: 'Tarjeta de propiedad',
    categoria: 'Vehículos',
    patrones: [[/tarjeta de identificacion vehicular/, 6], [/tarjeta de propiedad/, 6], [/\bsunarp\b.{0,80}vehicul/, 3], [/\bn(?:ro|°|º)?\.?\s*de\s*motor\b/, 2], [/\bvin\b|\bchasis\b/, 2], [/\bplaca\b/, 1]],
    alias: ['tarjeta de propiedad', 'tarjeta vehicular', 'tive'],
  },
  {
    tipo: 'DNI',
    categoria: 'Identidad y trámites',
    patrones: [[/documento nacional de identidad/, 6], [/\breniec\b/, 4], [/\bdni\b/, 3], [/\bcui\b/, 1], [/estado civil/, 1], [/fecha de nacimiento/, 1], [/republica del peru/, 1]],
    alias: ['dni', 'documento de identidad', 'carnet de identidad'],
  },
  {
    tipo: 'Pasaporte',
    categoria: 'Identidad y trámites',
    patrones: [[/\bpasaporte\b/, 6], [/\bpassport\b/, 6], [/p<per/, 6], [/migraciones/, 2]],
    alias: ['pasaporte'],
  },
  {
    tipo: 'Carné de extranjería',
    categoria: 'Identidad y trámites',
    patrones: [[/carne? de extranjeria/, 6], [/\bptp\b|permiso temporal de permanencia/, 5]],
    alias: ['carne de extranjeria', 'ptp'],
  },
  {
    tipo: 'Antecedentes',
    categoria: 'Identidad y trámites',
    patrones: [[/antecedentes (?:penales|policiales|judiciales)/, 6], [/certificado de antecedentes/, 6]],
    alias: ['antecedentes', 'antecedentes penales', 'antecedentes policiales'],
  },
  {
    tipo: 'Seguro de salud',
    categoria: 'Seguros',
    patrones: [[/\beps\b/, 3], [/seguro (?:oncologico|de salud|medico)/, 5], [/plan de salud/, 4], [/\bsis\b|seguro integral de salud/, 4], [/essalud/, 3], [/\bdeducible\b|\bcopago\b/, 2], [/\bpoliza\b/, 2]],
    alias: ['seguro de salud', 'eps', 'sis', 'essalud', 'seguro medico', 'plan de salud'],
  },
  {
    tipo: 'Seguro vehicular',
    categoria: 'Seguros',
    patrones: [[/seguro vehicular/, 6], [/todo riesgo/, 4], [/\bpoliza\b.{0,80}vehicul/, 3]],
    alias: ['seguro vehicular', 'todo riesgo', 'seguro del carro'],
  },
  {
    tipo: 'Seguro de vida',
    categoria: 'Seguros',
    patrones: [[/seguro de vida/, 6], [/vida ley/, 6], [/beneficiari[oa]s?/, 2], [/\bpoliza\b/, 2]],
    alias: ['seguro de vida', 'vida ley'],
  },
  {
    tipo: 'Póliza de seguro',
    categoria: 'Seguros',
    patrones: [[/\bpoliza\b/, 3], [/\baseguradora\b|\basegurado\b/, 2], [/\bprima\b/, 1], [/\bcobertura\b/, 2], [/\b(?:rimac|pacifico seguros|la positiva|mapfre|interseguro|protecta|chubb|qualitas|sanitas)\b/, 2]],
    alias: ['poliza', 'seguro'],
    generico: true,
  },
  {
    tipo: 'Contrato de alquiler',
    categoria: 'Contratos',
    patrones: [[/contrato de (?:arrendamiento|alquiler)/, 7], [/\barrendador\b|\barrendatari[oa]\b/, 4], [/\bmerced conductiva\b/, 4], [/\binmueble\b/, 1], [/\bgarantia\b/, 1]],
    alias: ['contrato de alquiler', 'alquiler', 'arrendamiento', 'contrato del depa', 'contrato del cuarto'],
  },
  {
    tipo: 'Contrato de trabajo',
    categoria: 'Contratos',
    patrones: [[/contrato (?:de trabajo|laboral|sujeto a modalidad|a plazo (?:fijo|indeterminado)|de locacion de servicios)/, 7], [/\bempleador\b|\btrabajador\b/, 2], [/\bremuneracion\b/, 2], [/periodo de prueba/, 2]],
    alias: ['contrato de trabajo', 'contrato laboral', 'contrato del trabajo'],
  },
  {
    tipo: 'Contrato',
    categoria: 'Contratos',
    patrones: [[/\bcontrato\b/, 4], [/\bclausula\b/, 2], [/\blas partes\b/, 2], [/\bconste por el presente\b/, 3], [/\bcontratante\b/, 2]],
    alias: ['contrato'],
    generico: true,
  },
  {
    tipo: 'Receta médica',
    categoria: 'Salud',
    patrones: [[/\breceta\b/, 4], [/\brp\/?\b|\bindicaciones\b/, 2], [/\bmg\b.{0,30}cada \d+ ?h/, 4], [/\bcmp\b/, 2]],
    alias: ['receta', 'receta medica'],
  },
  {
    tipo: 'Resultado de laboratorio',
    categoria: 'Salud',
    patrones: [[/\blaboratorio\b/, 3], [/hemograma|glucosa|colesterol|trigliceridos|hemoglobina/, 4], [/valores? de referencia/, 3], [/\bmg\/dl\b/, 2]],
    alias: ['analisis', 'resultados', 'laboratorio', 'examenes'],
  },
  {
    tipo: 'Documento médico',
    categoria: 'Salud',
    patrones: [[/\bclinica\b|\bhospital\b/, 2], [/\bdiagnostico\b/, 3], [/historia clinica/, 4], [/certificado medico|descanso medico/, 5], [/\bvacuna/, 3], [/\bpaciente\b/, 2]],
    alias: ['certificado medico', 'descanso medico', 'historia clinica', 'vacunas', 'carnet de vacunacion'],
  },
  {
    tipo: 'Recibo de luz',
    categoria: 'Hogar',
    patrones: [[/\b(?:enel|luz del sur|electro\w*|hidrandina|seal)\b/, 4], [/\bkwh\b/, 4], [/energia (?:electrica|activa)/, 3], [/\bsuministro\b/, 1]],
    alias: ['recibo de luz', 'luz'],
  },
  {
    tipo: 'Recibo de agua',
    categoria: 'Hogar',
    patrones: [[/\bsedapal\b|\bsedapar\b|\bepsel\b/, 5], [/\bm3\b.{0,30}agua|consumo de agua/, 3], [/alcantarillado/, 3]],
    alias: ['recibo de agua', 'agua'],
  },
  {
    tipo: 'Recibo de internet o celular',
    categoria: 'Hogar',
    patrones: [[/\b(?:movistar|claro|entel|bitel|win|wow)\b/, 3], [/\binternet\b|\bfibra\b|\bplan (?:postpago|movil)\b/, 2]],
    alias: ['recibo de internet', 'recibo del celular', 'internet', 'celular'],
  },
  {
    tipo: 'Título de propiedad',
    categoria: 'Hogar',
    patrones: [[/partida registral/, 4], [/titulo de propiedad/, 6], [/\bcofopri\b/, 4], [/\bsunarp\b/, 2], [/compra ?venta/, 3], [/\bminuta\b/, 3]],
    alias: ['titulo de propiedad', 'partida', 'escritura'],
  },
  {
    tipo: 'Impuestos',
    categoria: 'Finanzas e impuestos',
    patrones: [[/\bsunat\b/, 4], [/declaracion (?:jurada|anual)/, 3], [/impuesto a la renta/, 5], [/\bruc\b/, 2], [/\bpredial\b|\barbitrios\b|\bsat\b/, 4], [/\bigv\b/, 1]],
    alias: ['impuestos', 'sunat', 'renta', 'predial', 'arbitrios', 'ruc'],
  },
  {
    tipo: 'Boleta de pago',
    categoria: 'Finanzas e impuestos',
    patrones: [[/boleta de pago/, 6], [/\bplanilla\b/, 2], [/\bafp\b|\bonp\b/, 3], [/\bcts\b/, 3], [/\bgratificacion\b/, 3], [/total (?:neto|ingresos|descuentos)/, 2]],
    alias: ['boleta de pago', 'boleta', 'sueldo', 'planilla', 'cts', 'afp'],
  },
  {
    tipo: 'Estado de cuenta',
    categoria: 'Finanzas e impuestos',
    patrones: [[/estado de cuenta/, 6], [/\b(?:bcp|bbva|interbank|scotiabank|banbif|caja \w+)\b/, 3], [/tarjeta de credito/, 3], [/\bpago minimo\b/, 4], [/\bcuotas?\b/, 1], [/\btcea\b|\btea\b/, 3], [/\bprestamo\b|\bcredito\b/, 2]],
    alias: ['estado de cuenta', 'tarjeta', 'banco', 'prestamo', 'credito'],
  },
  {
    tipo: 'Comprobante',
    categoria: 'Finanzas e impuestos',
    patrones: [[/boleta de venta|factura electronica|\bfactura\b/, 4], [/\bop\.? gravada\b|\bsubtotal\b/, 2], [/\bigv\b/, 2], [/\btotal a pagar\b|\bimporte total\b/, 2]],
    alias: ['factura', 'boleta de venta', 'comprobante', 'garantia'],
  },
  {
    tipo: 'Certificado de estudios',
    categoria: 'Estudios',
    patrones: [[/\bsunedu\b/, 4], [/grado (?:academico|de bachiller)|\bbachiller\b|titulo profesional|\blicenciad[oa]\b/, 5], [/certificado de estudios|constancia de (?:estudios|egresado|matricula)/, 6], [/\buniversidad\b|\binstituto\b|\bcolegio\b/, 2], [/\bcreditos\b|\bsemestre\b|\bciclo\b/, 2], [/\bcertificado\b.{0,60}\bcurso\b|\bdiploma\b/, 4]],
    alias: ['titulo', 'bachiller', 'certificado de estudios', 'diploma', 'constancia', 'matricula'],
  },
];

const MIN_CONFIANZA = 5;

export function normalize(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
}

export type RuleResult = {
  tipo: string | null;
  categoria: CategoriaDoc;
  // Puntaje del mejor tipo; MIN_CONFIANZA o más es "seguro".
  puntaje: number;
  seguro: boolean;
  vigenciaAnios?: number;
};

export function classifyByRules(nombre: string, texto: string): RuleResult {
  const t = normalize(texto);
  const n = normalize(nombre);
  const puntajes = TIPOS.map((tipo) => {
    let puntaje = 0;
    for (const [re, peso] of tipo.patrones) {
      if (re.test(t)) puntaje += peso;
      if (re.test(n)) puntaje += peso * 2;
    }
    return { tipo, puntaje };
  });
  const hayEspecifico = puntajes.some((p) => !p.tipo.generico && p.puntaje >= MIN_CONFIANZA);
  let best: { tipo: TipoDoc; puntaje: number } | null = null;
  for (const p of puntajes) {
    if (hayEspecifico && p.tipo.generico) continue;
    if (p.puntaje > 0 && (!best || p.puntaje > best.puntaje)) best = p;
  }
  if (!best) return { tipo: null, categoria: 'Notas personales', puntaje: 0, seguro: false };
  return {
    tipo: best.tipo.tipo,
    categoria: best.tipo.categoria,
    puntaje: best.puntaje,
    seguro: best.puntaje >= MIN_CONFIANZA,
    vigenciaAnios: best.tipo.vigenciaAnios,
  };
}

export function vigenciaDe(tipo: string | null) {
  return TIPOS.find((t) => t.tipo === tipo)?.vigenciaAnios;
}

const ASEGURADORAS = ['Rímac', 'Pacífico', 'La Positiva', 'Mapfre', 'Interseguro', 'Protecta', 'Chubb', 'Qualitas', 'Sanitas', 'AFOCAT'];

// Datos sueltos que leo en código para armar el resumen sin IA.
export function extractFields(texto: string) {
  const t = normalize(texto);
  // Placas peruanas: ABC-123, A1B-234 (autos) o 1234-AB (motos), justo después de "placa".
  const placa = t.match(/placa\s*(?:n(?:ro|°|º|o)?\.?)?\s*:?\s*\b([a-z0-9]{3,4})\s?-?\s?([a-z0-9]{2,3})\b/);
  const placaOk = placa && /\d/.test(placa[1] + placa[2]) && /[a-z]/.test(placa[1] + placa[2]) ? `${placa[1]}-${placa[2]}`.toUpperCase() : undefined;
  const aseguradora = ASEGURADORAS.find((a) => t.includes(normalize(a)));
  const poliza = t.match(/(?:poliza|certificado)\s*(?:n(?:ro|°|º|o)?\.?\s*)?:?\s*([a-z0-9-]{5,})/);
  const ultimos4 = poliza?.[1].replace(/\D/g, '').slice(-4);
  return { placa: placaOk, aseguradora, poliza: ultimos4 && ultimos4.length === 4 ? ultimos4 : undefined };
}

export function resumenPorReglas(tipo: string | null, texto: string, nombre: string) {
  if (!tipo) return nombre;
  const f = extractFields(texto);
  const partes = [tipo];
  if (f.aseguradora) partes.push(f.aseguradora);
  if (f.placa) partes.push(`placa ${f.placa}`);
  if (f.poliza) partes.push(`póliza ···${f.poliza}`);
  return partes.join(' · ');
}

// ¿A qué tipo de documento se refiere una pregunta? ("¿cuándo vence mi soat?" → SOAT)
export function tipoDesdePregunta(pregunta: string) {
  const q = ` ${normalize(pregunta).replace(/[^a-z0-9 ]/g, ' ')} `;
  let best: { tipo: string; largo: number } | null = null;
  for (const t of TIPOS) {
    for (const a of t.alias) {
      if (q.includes(` ${a} `) && (!best || a.length > best.largo)) best = { tipo: t.tipo, largo: a.length };
    }
  }
  return best?.tipo ?? null;
}
