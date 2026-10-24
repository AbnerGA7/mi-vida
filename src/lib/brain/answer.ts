// Respuestas sin IA para las preguntas de siempre ("¿cuándo vence mi SOAT?"): salen al instante,
// sin descargar nada y con la fecha exacta guardada, así que no hay riesgo de que la IA la invente.

import { normalize } from '@/lib/brain/classify';

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
