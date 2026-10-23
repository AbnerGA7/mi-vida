// Reglas de ajuste en código: cambian el plan según mis datos reales, no por intuición de la IA.

import type { Objetivo } from '@/lib/coach/nutrition';

export type Checkin = { semana: string; peso_promedio: number | null; energia: number | null; sueno: number | null };
export type Log = { fecha: string; ejercicio: string; peso_kg: number; repeticiones: number };
export type Ajuste = { tipo: 'calorias' | 'volumen' | 'ejercicio' | 'salud'; detalle: string; deltaCalorias?: number };

// Checkins ordenados del más antiguo al más reciente.
export function calorieAdjustment(objetivo: Objetivo, checkins: Checkin[]): Ajuste | null {
  const pesos = checkins.map((c) => c.peso_promedio).filter((p): p is number => p != null);
  if (pesos.length < 3 || objetivo === 'mantener') return null;
  const [a, b, c] = pesos.slice(-3);
  const cambio1 = b - a;
  const cambio2 = c - b;

  // 2 semanas seguidas sin moverse en la dirección esperada.
  if (objetivo === 'grasa' && cambio1 >= -0.1 && cambio2 >= -0.1) {
    return { tipo: 'calorias', detalle: `Peso estancado 2 semanas (${a} → ${c} kg): bajo 150 kcal.`, deltaCalorias: -150 };
  }
  if (objetivo === 'masa' && cambio1 <= 0.05 && cambio2 <= 0.05) {
    return { tipo: 'calorias', detalle: `No subo de peso hace 2 semanas (${a} → ${c} kg): subo 150 kcal.`, deltaCalorias: 150 };
  }
  return null;
}

export function recoveryAdjustment(checkins: Checkin[]): Ajuste | null {
  const ultimas = checkins.slice(-2);
  if (ultimas.length < 2) return null;
  const prom = (k: 'energia' | 'sueno') => ultimas.reduce((s, c) => s + (c[k] ?? 10), 0) / ultimas.length;
  if (prom('energia') < 5 || prom('sueno') < 5) {
    return { tipo: 'volumen', detalle: 'Energía o sueño bajos 2 semanas: quito 1 serie por ejercicio (≈20% menos volumen).' };
  }
  return null;
}

// Un ejercicio está estancado si en las últimas 3 sesiones no mejoró peso ni repeticiones.
export function stalledExercises(logs: Log[]): Ajuste[] {
  const porEjercicio = new Map<string, Map<string, number>>();
  for (const l of logs) {
    const sesiones = porEjercicio.get(l.ejercicio) ?? new Map<string, number>();
    // Mejor serie del día: peso × reps.
    sesiones.set(l.fecha, Math.max(sesiones.get(l.fecha) ?? 0, l.peso_kg * l.repeticiones));
    porEjercicio.set(l.ejercicio, sesiones);
  }
  const ajustes: Ajuste[] = [];
  for (const [ejercicio, sesiones] of porEjercicio) {
    const marcas = [...sesiones.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
    if (marcas.length < 4) continue;
    const [antes, ...ultimas3] = marcas.slice(-4);
    if (ultimas3.every((m) => m <= antes)) {
      ajustes.push({ tipo: 'ejercicio', detalle: `${ejercicio} sin progreso en 3 sesiones: cambia a su alternativa o baja a 3×10.` });
    }
  }
  return ajustes;
}

const ALERTA_SALUD = /dolor agudo|mareo|desmay|pecho|lesi[oó]n nueva|hinchaz/i;

export function healthCheck(notas: string | null): Ajuste | null {
  if (!notas || !ALERTA_SALUD.test(notas)) return null;
  return { tipo: 'salud', detalle: 'Mencionaste un síntoma de alerta: no subas cargas y consulta a un médico.' };
}
