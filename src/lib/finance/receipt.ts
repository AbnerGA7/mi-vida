// Leo boletas y facturas peruanas desde el texto del OCR, en código y sin IA.

import { findDates } from '@/lib/brain/dates';

export type Receipt = { monto: number; comercio: string; fecha: string | null; categoria: string };

// Tiendas comunes → categoría de Mi plata.
const TIENDAS: [RegExp, string][] = [
  [/tottus|plaza ?vea|metro|wong|makro|mass\b|tambo|oxxo|vivanda|mercado|bodega|minimarket|panaderia/, 'comida'],
  [/kfc|bembos|pardos|norky|pizza|chifa|polleria|restaurant|cevicheria|starbucks|mcdonald|burger/, 'comida'],
  [/inkafarma|mifarma|boticas?|farmacia|clinica|laboratorio/, 'salud'],
  [/repsol|primax|petroper[uú]|pecsa|grifo|estacion de servicio/, 'transporte'],
  [/sodimac|promart|maestro|cassinelli/, 'casa'],
  [/saga|falabella|ripley|oechsle|h&m|zara|topitop/, 'ropa'],
  [/cineplanet|cinemark|cinepolis|teleticket|joinnus/, 'ocio'],
  [/smart ?fit|bodytech|gold'?s gym|gimnasio/, 'gym'],
  [/libreria|crisol|tai loy|universidad|instituto/, 'estudios'],
];

const NUMERO = /(\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}|\d+[.,]\d{2}|\d+)/;

function aNumero(texto: string) {
  // "1,234.50" o "1.234,50" o "45,90" → número.
  const limpio = texto.replace(/\s/g, '');
  const decimal = limpio.match(/[.,](\d{2})$/);
  const entero = (decimal ? limpio.slice(0, -3) : limpio).replace(/[.,]/g, '');
  return Number(`${entero}.${decimal ? decimal[1] : '00'}`);
}

function normalizar(t: string) {
  return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// El total es el monto junto a "TOTAL" (no subtotal, op. gravada ni IGV). Si no aparece, el mayor S/.
export function findTotal(texto: string) {
  const lineas = texto.split(/\n+/).map(normalizar);
  let total: number | null = null;
  for (const [i, l] of lineas.entries()) {
    if (!/\btotal\b|importe total|total a pagar/.test(l) || /sub\s?total|gravad|igv|descuento|items?\b/.test(l)) continue;
    const enLinea = l.slice(l.search(/total/)).match(NUMERO) ?? lineas[i + 1]?.match(NUMERO);
    if (enLinea) total = aNumero(enLinea[1]);
  }
  if (total && total > 0) return total;
  const soles = [...texto.matchAll(/S\/\.?\s?(\d[\d.,\s]*\d)/g)].map((m) => aNumero(m[1])).filter((n) => n > 0);
  return soles.length ? Math.max(...soles) : null;
}

// El comercio suele ser la primera línea con letras, antes del RUC.
export function findComercio(texto: string) {
  for (const linea of texto.split(/\n+/).slice(0, 6)) {
    const l = linea.trim();
    if (l.length < 3 || !/[a-z]{3,}/i.test(l)) continue;
    if (/\bruc\b|boleta|factura|electr[oó]nica|^av\.|jr\.|calle|telf|tel[eé]fono/i.test(l)) continue;
    return l.replace(/\s+/g, ' ').slice(0, 40);
  }
  return 'Compra';
}

export function categoriaDe(comercio: string, texto = '') {
  const t = normalizar(`${comercio}\n${texto}`);
  return TIENDAS.find(([re]) => re.test(t))?.[1] ?? 'otros';
}

export function parseReceipt(texto: string): Receipt | null {
  const monto = findTotal(texto);
  if (!monto) return null;
  const comercio = findComercio(texto);
  return { monto, comercio, fecha: findDates(texto)[0]?.fecha ?? null, categoria: categoriaDe(comercio, texto) };
}
