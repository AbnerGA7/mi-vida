// Reglas en código para decidir si vale la pena recalcular el resumen en segundo plano.
// Android despierta la tarea cuando quiere (cada ~2 h como mínimo), así que filtro aquí.

const HORAS_ENTRE_CALCULOS = 3;

const diaLocal = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

// Recalculo si el último resumen es de otro día (las tareas "de hoy" cambiaron) o si estoy
// en la madrugada antes de la hora del resumen y pasaron varias horas desde el último.
export function shouldRefreshBrief(now: Date, ultimo: string | null, horaResumen: number) {
  if (!ultimo) return true;
  const antes = new Date(ultimo);
  if (Number.isNaN(antes.getTime()) || antes > now) return true;
  if (diaLocal(antes) !== diaLocal(now)) return true;
  const horas = (now.getTime() - antes.getTime()) / 3600000;
  return now.getHours() < horaResumen && horas >= HORAS_ENTRE_CALCULOS;
}
