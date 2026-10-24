// Plan de avisos de vencimiento en código puro (sin módulos nativos, así se puede probar).

import { formatFecha } from '@/lib/brain/dates';

// Aviso con un mes de margen para trámites largos, una semana antes y el día anterior.
export const DIAS_AVISO = [30, 7, 1] as const;
export const HORA_AVISO = 9;

export type DocConVencimiento = { id: number; nombre: string; fecha_vencimiento: string | null };

export type Aviso = { docId: number; cuando: Date; titulo: string; texto: string };

function fechaLocal(fecha: string, hora: number) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, hora, 0, 0, 0);
}

// Para cada documento con fecha, un aviso por cada plazo que todavía no pasó.
export function planExpiryReminders(docs: DocConVencimiento[], ahora = new Date()): Aviso[] {
  const avisos: Aviso[] = [];
  for (const doc of docs) {
    if (!doc.fecha_vencimiento) continue;
    const vence = fechaLocal(doc.fecha_vencimiento, HORA_AVISO);
    for (const dias of DIAS_AVISO) {
      const cuando = new Date(vence);
      cuando.setDate(cuando.getDate() - dias);
      if (cuando.getTime() <= ahora.getTime()) continue;
      const plazo = dias === 1 ? 'mañana' : `en ${dias} días`;
      avisos.push({
        docId: doc.id,
        cuando,
        titulo: `📄 ${doc.nombre} vence ${plazo}`,
        texto: `Vence el ${formatFecha(doc.fecha_vencimiento)}. Ve renovándolo para no quedarte sin él.`,
      });
    }
  }
  return avisos.sort((a, b) => a.cuando.getTime() - b.cuando.getTime());
}
