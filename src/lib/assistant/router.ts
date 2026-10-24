// Asistente central: decido en código a qué módulo va cada pregunta (sin IA, al instante).

import { normalize } from '@/lib/brain/classify';
import { CATEGORIAS } from '@/lib/finance/categories';

export type Modulo = 'plata' | 'cerebro' | 'coach' | 'tareas';

export type Ruta =
  | { modulo: 'plata'; tema: 'balance' | 'categoria' | 'metas' | 'pagos' | 'presupuestos'; categoria?: string }
  | { modulo: 'coach'; tema: 'calorias' | 'rutina' }
  | { modulo: 'tareas' }
  | { modulo: 'cerebro' };

const PALABRAS_CATEGORIA: Record<string, string> = {
  comida: 'comida', comer: 'comida', menu: 'comida', almuerzo: 'comida', restaurante: 'comida',
  transporte: 'transporte', taxi: 'transporte', pasajes: 'transporte', gasolina: 'transporte',
  casa: 'casa', alquiler: 'casa', servicios: 'servicios', luz: 'servicios', agua: 'servicios', internet: 'servicios',
  salud: 'salud', farmacia: 'salud', gym: 'gym', gimnasio: 'gym', estudios: 'estudios', ocio: 'ocio',
  salidas: 'ocio', ropa: 'ropa', deudas: 'deudas',
};

export function routeQuestion(pregunta: string): Ruta | null {
  const q = ` ${normalize(pregunta).replace(/[¿?¡!.,]/g, ' ')} `;

  if (/\b(meta|metas|ahorr\w*|alcancia|chanchito)\b/.test(q)) return { modulo: 'plata', tema: 'metas' };
  if (/\b(pago|pagos|pagar|cuota|cuotas)\b/.test(q) && !/\b(soat|poliza|documento)\b/.test(q)) {
    return { modulo: 'plata', tema: 'pagos' };
  }
  if (/\bpresupuest\w*|semaforo\b/.test(q)) return { modulo: 'plata', tema: 'presupuestos' };
  if (/\b(gaste|gasto|gastado|gastos|gastando)\b/.test(q)) {
    const palabra = q.split(/\s+/).find((w) => PALABRAS_CATEGORIA[w] || (CATEGORIAS as readonly string[]).includes(w));
    if (palabra) return { modulo: 'plata', tema: 'categoria', categoria: PALABRAS_CATEGORIA[palabra] ?? palabra };
    return { modulo: 'plata', tema: 'balance' };
  }
  if (/\b(balance|plata|dinero|ingres\w*|cuanto (me )?queda|sueldo)\b/.test(q)) return { modulo: 'plata', tema: 'balance' };

  if (/\b(calorias|kcal|macros|proteina|carbohidratos|carbos|grasa|comer hoy)\b/.test(q)) return { modulo: 'coach', tema: 'calorias' };
  if (/\b(rutina|entren\w*|gym|ejercicio\w*|toca hoy|piernas|pecho|espalda)\b/.test(q)) return { modulo: 'coach', tema: 'rutina' };

  if (/\b(tarea|tareas|pendiente\w*|que tengo que hacer|por hacer)\b/.test(q)) return { modulo: 'tareas' };

  if (/\b(document\w*|soat|dni|brevete|licencia|pasaporte|contrato|poliza|seguro|vence|vencimiento|vigente|papeles)\b/.test(q)) {
    return { modulo: 'cerebro' };
  }
  return null;
}
