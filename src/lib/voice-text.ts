// Arreglos de texto para la voz, sin módulos nativos (así se pueden probar).

import { formatFecha } from '@/lib/brain/dates';

// Palabras que el reconocedor de Google confunde a menudo. También se le pasan como pistas al dictado.
export const PALABRAS_DICTADO = ['SOAT', 'DNI', 'brevete', 'póliza', 'Rímac', 'Pacífico', 'La Positiva', 'Mapfre', 'EPS', 'SUNAT', 'CTS', 'AFP', 'revisión técnica', 'tarjeta de propiedad', 'Yape', 'Plin'];

const CORRECCIONES: [RegExp, string][] = [
  [/\b(?:so at|zoat|soad|s\.?\s?o\.?\s?a\.?\s?t\.?|sowat|so hat)\b/gi, 'SOAT'],
  [/\b(?:d\.?\s?n\.?\s?i\.?|de ene i|dene i)\b/gi, 'DNI'],
  [/\b(?:brevet|brevette|breve te)\b/gi, 'brevete'],
  [/\b(?:sunat|su nat)\b/gi, 'SUNAT'],
  [/\b(?:yap|llape|yapé)\b/gi, 'yape'],
];

export function fixDictation(texto: string) {
  return CORRECCIONES.reduce((t, [re, bien]) => t.replace(re, bien), texto).replace(/\s+/g, ' ').trim();
}

function soles(entero: string, decimales?: string) {
  const n = entero.replace(/[,\s]/g, '');
  const cent = decimales && Number(decimales) > 0 ? ` con ${Number(decimales)} céntimos` : '';
  return `${n} ${n === '1' ? 'sol' : 'soles'}${cent}`;
}

// Dejo el texto listo para leerlo en voz alta: sin marcas de fuente ni markdown,
// con fechas y montos como los diría una persona.
export function textoParaVoz(texto: string) {
  return texto
    .replace(/\[\d+\]/g, '')
    .replace(/Fuentes?:.*$/gim, '')
    .replace(/[*_#`>]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_, y, m, d) => formatFecha(`${y}-${m}-${d}`))
    .replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (_, d, m, y) => formatFecha(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`))
    .replace(/S\/\.?\s?(\d{1,3}(?:[,\s]\d{3})*|\d+)(?:\.(\d{1,2}))?/g, (_, e, dec) => soles(e, dec))
    .replace(/···\s?(\d{4})/g, (_, n) => `que termina en ${n.split('').join(' ')}`)
    .replace(/\bN[°º]\s?/g, 'número ')
    .replace(/\s*;\s*/g, '. ')
    .replace(/\s+([.,])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
