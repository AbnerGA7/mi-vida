// Registro rápido sin IA: lo común ("25 menú con yape") lo entiendo en código.
// Sin dependencias nativas para poder probarlo con bun test.
import { CATEGORIAS, CUENTAS } from '@/lib/finance/categories';
import type { NewTransaction } from '@/lib/finance/repository';

type Categoria = (typeof CATEGORIAS)[number];
type Cuenta = (typeof CUENTAS)[number];

export const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Palabras comunes que resuelvo sin IA: instantáneo y sin gastar batería.
// Se comparan sin tildes y también por raíz (ej. "pasajes" → "pasaje").
const KEYWORDS: Record<string, Categoria> = {
  // comida
  menu: 'comida', almuerzo: 'comida', cena: 'comida', desayuno: 'comida', lonche: 'comida', pollo: 'comida',
  polleria: 'comida', chifa: 'comida', ceviche: 'comida', comida: 'comida', mercado: 'comida', supermercado: 'comida',
  vea: 'comida', tottus: 'comida', wong: 'comida', bodega: 'comida', pan: 'comida',
  cafe: 'comida', gaseosa: 'comida', snack: 'comida', galletas: 'comida', fruta: 'comida',
  delivery: 'comida', rappi: 'comida', pedidosya: 'comida', hamburguesa: 'comida', pizza: 'comida', kfc: 'comida',
  // transporte
  pasaje: 'transporte', combi: 'transporte', taxi: 'transporte', uber: 'transporte', didi: 'transporte',
  cabify: 'transporte', indriver: 'transporte', bus: 'transporte', micro: 'transporte', metropolitano: 'transporte',
  tren: 'transporte', moto: 'transporte', mototaxi: 'transporte', gasolina: 'transporte', grifo: 'transporte',
  peaje: 'transporte', estacionamiento: 'transporte', cochera: 'transporte', colectivo: 'transporte',
  // casa
  alquiler: 'casa', cuarto: 'casa', depa: 'casa', departamento: 'casa', limpieza: 'casa', detergente: 'casa',
  mueble: 'casa', ferreteria: 'casa', sodimac: 'casa', promart: 'casa',
  // servicios
  luz: 'servicios', agua: 'servicios', internet: 'servicios', celular: 'servicios', recarga: 'servicios',
  plan: 'servicios', cable: 'servicios', netflix: 'servicios', spotify: 'servicios', youtube: 'servicios',
  disney: 'servicios', gas: 'servicios', telefono: 'servicios', claro: 'servicios', movistar: 'servicios',
  entel: 'servicios', bitel: 'servicios', sedapal: 'servicios', enel: 'servicios', luzdelsur: 'servicios',
  // salud
  farmacia: 'salud', doctor: 'salud', medico: 'salud', pastillas: 'salud', medicina: 'salud', inkafarma: 'salud',
  mifarma: 'salud', clinica: 'salud', consulta: 'salud', dentista: 'salud', analisis: 'salud', vitaminas: 'salud',
  // gym
  gym: 'gym', gimnasio: 'gym', proteina: 'gym', creatina: 'gym', suplemento: 'gym', smartfit: 'gym',
  // estudios
  libro: 'estudios', curso: 'estudios', universidad: 'estudios', pension: 'estudios', matricula: 'estudios',
  copias: 'estudios', utiles: 'estudios', udemy: 'estudios', platzi: 'estudios', instituto: 'estudios',
  // ocio
  cine: 'ocio', salida: 'ocio', cerveza: 'ocio', chela: 'ocio', chelas: 'ocio', trago: 'ocio', discoteca: 'ocio',
  juego: 'ocio', steam: 'ocio', concierto: 'ocio', viaje: 'ocio', regalo: 'ocio', fiesta: 'ocio', bar: 'ocio',
  // ropa
  ropa: 'ropa', zapatillas: 'ropa', zapatos: 'ropa', polo: 'ropa', pantalon: 'ropa', casaca: 'ropa',
  saga: 'ropa', ripley: 'ropa', zara: 'ropa', gamarra: 'ropa',
  // deudas
  tarjeta: 'deudas', prestamo: 'deudas', deuda: 'deudas', cuota: 'deudas',
};

export const CUENTA_ALIAS: Record<string, Cuenta> = {
  efectivo: 'efectivo', cash: 'efectivo', yape: 'yape', yapee: 'yape', yapeo: 'yape', yapie: 'yape',
  plin: 'plin', debito: 'debito', credito: 'credito', visa: 'credito', mastercard: 'credito',
};

// La cuenta con la que pagué o me pagaron: también entiende "yapeé", "me yapearon" o "pliné".
export function findCuenta(words: string[]): Cuenta {
  for (const w of words) {
    if (CUENTA_ALIAS[w]) return CUENTA_ALIAS[w];
    if (w.startsWith('yape')) return 'yape';
    if (w.startsWith('plin')) return 'plin';
  }
  return 'efectivo';
}

const INGRESO_RE = /\b(cobre|me pagaron|me depositaron|me yapearon|me plinearon|sueldo|salario|ingreso|gane|recibi|me devolvieron|propina|venta|vendi|freelance|quincena)\b/;

export function today() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function findMonto(lower: string) {
  // "1,200.50", "1200", "25.5", "25,50", "s/25", "s/. 25", "25 soles", "2k", "2 mil"
  const mil = lower.match(/(\d+(?:[.,]\d+)?)\s*(k|mil)\b/);
  if (mil) return Number(mil[1].replace(',', '.')) * 1000;
  const m = lower.match(/(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/);
  if (!m) return null;
  let raw = m[1];
  // Separador de miles ("1,200" o "1.200") vs decimales ("25,50").
  if (/^\d{1,3}([.,]\d{3})+([.,]\d{1,2})?$/.test(raw)) {
    const dec = raw.match(/[.,](\d{1,2})$/);
    raw = dec ? raw.slice(0, -dec[0].length).replace(/[.,]/g, '') + '.' + dec[1] : raw.replace(/[.,]/g, '');
  } else {
    raw = raw.replace(',', '.');
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function findCategoria(words: string[]): Categoria | undefined {
  // "con tarjeta" es cómo pagué, no una deuda: lo salto y busco qué compré.
  const comoPague = (i: number) => words[i] === 'tarjeta' && words[i - 1] === 'con';
  for (const [i, w] of words.entries()) {
    if (comoPague(i)) continue;
    if (KEYWORDS[w]) return KEYWORDS[w];
    // plurales simples: "pasajes" → "pasaje", "doctores" → "doctor"
    for (const singular of [w.replace(/s$/, ''), w.replace(/es$/, '')]) {
      if (KEYWORDS[singular]) return KEYWORDS[singular];
    }
  }
  return undefined;
}

export function parseSimple(texto: string): NewTransaction | null {
  const lower = sinTildes(texto);
  const monto = findMonto(lower);
  if (!monto) return null;

  const words = lower.split(/[^a-z0-9]+/).filter(Boolean);
  const cuenta = findCuenta(words);

  if (INGRESO_RE.test(lower)) {
    return { fecha: today(), monto, tipo: 'ingreso', descripcion: texto.trim(), categoria: 'otros', cuenta };
  }

  const categoria = findCategoria(words);
  if (!categoria) return null;
  return { fecha: today(), monto, tipo: 'gasto', descripcion: texto.trim(), categoria, cuenta };
}
