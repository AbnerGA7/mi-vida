// Arreglos de texto para la voz, sin módulos nativos (así se pueden probar).

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
