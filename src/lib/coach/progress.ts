// Progreso del Coach en código puro: semanas ISO, peso por semana y volumen de entrenamiento.

// Semana ISO como la guardo en los registros semanales: "2026-S43".
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}

export type Punto = { etiqueta: string; valor: number };

// "2026-S43" → "S43", para que la etiqueta quepa debajo de cada barra.
export function etiquetaSemana(semana: string) {
  return semana.split('-').at(-1) ?? semana;
}

// Peso promedio de las últimas semanas registradas (las que no tienen peso no cuentan).
export function weightSeries(checkins: { semana: string; peso_promedio: number | null }[], semanas = 8): Punto[] {
  return checkins
    .filter((c) => c.peso_promedio != null && c.peso_promedio > 0)
    .sort((a, b) => a.semana.localeCompare(b.semana))
    .slice(-semanas)
    .map((c) => ({ etiqueta: etiquetaSemana(c.semana), valor: c.peso_promedio! }));
}

// Volumen por semana: suma de peso × repeticiones de todas las series (kg movidos).
export function weeklyVolume(logs: { fecha: string; peso_kg: number; repeticiones: number }[], semanas = 8): Punto[] {
  const porSemana = new Map<string, number>();
  for (const l of logs) {
    const [y, m, d] = l.fecha.split('-').map(Number);
    const s = isoWeek(new Date(y, m - 1, d));
    porSemana.set(s, (porSemana.get(s) ?? 0) + l.peso_kg * l.repeticiones);
  }
  return [...porSemana]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-semanas)
    .map(([s, v]) => ({ etiqueta: etiquetaSemana(s), valor: Math.round(v) }));
}

// Cambio entre la primera y la última semana, para el titular de cada gráfica.
export function tendencia(puntos: Punto[]) {
  if (puntos.length < 2) return null;
  return Math.round((puntos.at(-1)!.valor - puntos[0].valor) * 10) / 10;
}
