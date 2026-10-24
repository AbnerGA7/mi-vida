// Rutinas base en código: probadas, predecibles y sin depender de la IA.

export type Ejercicio = { nombre: string; series: number; reps: string; descanso: string; alternativa: string };
export type Sesion = { nombre: string; ejercicios: Ejercicio[] };
export type Rutina = { division: string; motivo: string; sesiones: Sesion[] };

const e = (nombre: string, series: number, reps: string, alternativa: string, descanso = '90 s'): Ejercicio => ({
  nombre,
  series,
  reps,
  descanso,
  alternativa,
});

const FULL_A: Sesion = {
  nombre: 'Cuerpo completo A',
  ejercicios: [
    e('Sentadilla', 3, '6-8', 'Prensa', '2 min'),
    e('Press banca', 3, '6-8', 'Press con mancuernas', '2 min'),
    e('Remo con barra', 3, '8-10', 'Remo en polea'),
    e('Press militar', 2, '8-10', 'Press con mancuernas sentado'),
    e('Plancha', 3, '30-45 s', 'Dead bug', '60 s'),
  ],
};
const FULL_B: Sesion = {
  nombre: 'Cuerpo completo B',
  ejercicios: [
    e('Peso muerto rumano', 3, '8-10', 'Hip thrust', '2 min'),
    e('Dominadas', 3, '6-10', 'Jalón al pecho'),
    e('Press inclinado mancuernas', 3, '8-12', 'Fondos asistidos'),
    e('Zancadas', 2, '10-12', 'Sentadilla búlgara'),
    e('Curl + extensión tríceps', 2, '12-15', 'Bandas', '60 s'),
  ],
};
const UPPER: Sesion = {
  nombre: 'Torso',
  ejercicios: [
    e('Press banca', 4, '6-8', 'Press con mancuernas', '2 min'),
    e('Remo con barra', 4, '8-10', 'Remo en polea'),
    e('Press militar', 3, '8-10', 'Elevaciones laterales'),
    e('Jalón al pecho', 3, '10-12', 'Dominadas asistidas'),
    e('Curl y tríceps', 3, '12-15', 'Bandas', '60 s'),
  ],
};
const LOWER: Sesion = {
  nombre: 'Pierna',
  ejercicios: [
    e('Sentadilla', 4, '6-8', 'Prensa', '2 min'),
    e('Peso muerto rumano', 3, '8-10', 'Curl femoral'),
    e('Zancadas', 3, '10-12', 'Sentadilla búlgara'),
    e('Elevación de talones', 3, '12-15', 'En máquina', '60 s'),
    e('Plancha', 3, '30-45 s', 'Dead bug', '60 s'),
  ],
};
const PUSH: Sesion = {
  nombre: 'Empuje',
  ejercicios: [
    e('Press banca', 4, '6-8', 'Press con mancuernas', '2 min'),
    e('Press militar', 3, '8-10', 'Press Arnold'),
    e('Press inclinado mancuernas', 3, '10-12', 'Aperturas'),
    e('Elevaciones laterales', 3, '12-15', 'En polea', '60 s'),
    e('Extensión de tríceps', 3, '12-15', 'Fondos', '60 s'),
  ],
};
const PULL: Sesion = {
  nombre: 'Jalón',
  ejercicios: [
    e('Dominadas', 4, '6-10', 'Jalón al pecho', '2 min'),
    e('Remo con barra', 3, '8-10', 'Remo en polea'),
    e('Face pull', 3, '12-15', 'Pájaros', '60 s'),
    e('Curl con barra', 3, '10-12', 'Curl martillo', '60 s'),
  ],
};

export function buildRoutine(dias: number): Rutina {
  if (dias <= 3) {
    return {
      division: 'Cuerpo completo',
      motivo: 'Con 2-3 días, entrenar todo el cuerpo en cada sesión da la mejor frecuencia por músculo.',
      sesiones: dias <= 2 ? [FULL_A, FULL_B] : [FULL_A, FULL_B, FULL_A],
    };
  }
  if (dias === 4) {
    return {
      division: 'Torso / Pierna',
      motivo: 'Con 4 días, cada músculo se entrena 2 veces por semana con buen descanso.',
      sesiones: [UPPER, LOWER, UPPER, LOWER],
    };
  }
  return {
    division: 'Empuje / Jalón / Pierna',
    motivo: 'Con 5-6 días, dividir por patrones permite más volumen sin sobrecargar.',
    sesiones: dias === 5 ? [PUSH, PULL, LOWER, UPPER, LOWER] : [PUSH, PULL, LOWER, PUSH, PULL, LOWER],
  };
}

// Cambio ejercicios que chocan con mis lesiones por su alternativa.
const RIESGO: Record<string, string[]> = {
  rodilla: ['Sentadilla', 'Zancadas', 'Sentadilla búlgara'],
  espalda: ['Peso muerto rumano', 'Remo con barra', 'Sentadilla'],
  hombro: ['Press militar', 'Press banca', 'Dominadas'],
};

// Si la alternativa también es riesgosa, uso un ejercicio seguro para esa zona.
const SEGURO: Record<string, string> = {
  rodilla: 'Hip thrust',
  espalda: 'Prensa',
  hombro: 'Remo en polea',
};

// Cómo lo suelo escribir: "menisco", "lumbar", "hernia", "manguito rotador"…
const SINONIMOS: Record<string, string[]> = {
  rodilla: ['rodilla', 'menisco', 'ligamento cruzado', 'rotula', 'patelar'],
  espalda: ['espalda', 'lumbar', 'lumbago', 'columna', 'hernia', 'ciatica'],
  hombro: ['hombro', 'manguito', 'rotador', 'clavicula'],
};

export function adaptToInjuries(rutina: Rutina, lesiones: string | null): Rutina {
  const texto = (lesiones ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const zonas = Object.keys(RIESGO).filter((zona) => SINONIMOS[zona].some((p) => texto.includes(p)));
  if (zonas.length === 0) return rutina;
  const evitar = new Set(zonas.flatMap((zona) => RIESGO[zona]));
  const reemplazo = (ej: Ejercicio) => (evitar.has(ej.alternativa) ? SEGURO[zonas[0]] : ej.alternativa);
  return {
    ...rutina,
    sesiones: rutina.sesiones.map((s) => ({
      ...s,
      ejercicios: s.ejercicios.map((ej) =>
        evitar.has(ej.nombre) ? { ...ej, nombre: reemplazo(ej), alternativa: ej.nombre } : ej,
      ),
    })),
  };
}

// Sesión de hoy: roto por el número de sesiones según el día del año.
export function todaySession(rutina: Rutina, today = new Date()) {
  const start = new Date(today.getFullYear(), 0, 0).getTime();
  const dia = Math.floor((today.getTime() - start) / 86400000);
  return rutina.sesiones[dia % rutina.sesiones.length];
}
