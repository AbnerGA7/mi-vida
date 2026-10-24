import { askAi, type AiOptions } from '@/lib/ai';
import {
  calorieAdjustment,
  healthCheck,
  recoveryAdjustment,
  stalledExercises,
  type Ajuste,
  type Checkin,
  type Log,
} from '@/lib/coach/adjust';
import { computeTargets, type Objetivo, type ProfileInput, type Sexo } from '@/lib/coach/nutrition';
import { getDb } from '@/lib/db';

export type Profile = ProfileInput & {
  lesiones: string | null;
  alimentos_excluidos: string | null;
  calorias: number;
  proteina_g: number;
  grasa_g: number;
  carbohidratos_g: number;
};

export async function getProfile() {
  const db = await getDb();
  return db.getFirstAsync<Profile & { sexo: Sexo; objetivo: Objetivo }>('SELECT * FROM coach_profile WHERE id = 1');
}

export async function saveProfile(input: ProfileInput & { lesiones: string; alimentos_excluidos: string }) {
  const t = computeTargets(input);
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO coach_profile (id, edad, sexo, estatura_cm, peso_kg, objetivo, dias_por_semana, lesiones,
       alimentos_excluidos, calorias, proteina_g, grasa_g, carbohidratos_g)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET edad = excluded.edad, sexo = excluded.sexo, estatura_cm = excluded.estatura_cm,
       peso_kg = excluded.peso_kg, objetivo = excluded.objetivo, dias_por_semana = excluded.dias_por_semana,
       lesiones = excluded.lesiones, alimentos_excluidos = excluded.alimentos_excluidos, calorias = excluded.calorias,
       proteina_g = excluded.proteina_g, grasa_g = excluded.grasa_g, carbohidratos_g = excluded.carbohidratos_g,
       updated_at = datetime('now')`,
    input.edad,
    input.sexo,
    input.estatura_cm,
    input.peso_kg,
    input.objetivo,
    input.dias_por_semana,
    input.lesiones,
    input.alimentos_excluidos,
    t.calorias,
    t.proteina_g,
    t.grasa_g,
    t.carbohidratos_g,
  );
  return t;
}

export async function logSet(log: Log & { serie: number }) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO workout_logs (fecha, ejercicio, serie, peso_kg, repeticiones) VALUES (?, ?, ?, ?, ?)',
    log.fecha,
    log.ejercicio,
    log.serie,
    log.peso_kg,
    log.repeticiones,
  );
}

export async function lastSetFor(ejercicio: string) {
  const db = await getDb();
  return db.getFirstAsync<Log>(
    'SELECT fecha, ejercicio, peso_kg, repeticiones FROM workout_logs WHERE ejercicio = ? ORDER BY fecha DESC, id DESC LIMIT 1',
    ejercicio,
  );
}

export async function setsToday(fecha: string) {
  const db = await getDb();
  return db.getAllAsync<Log & { serie: number }>('SELECT * FROM workout_logs WHERE fecha = ? ORDER BY id', fecha);
}

// Guardo el registro semanal, corro las reglas y aplico el ajuste de calorías si corresponde.
export async function saveCheckin(c: Checkin & { notas: string }): Promise<Ajuste[]> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO checkins (semana, peso_promedio, energia, sueno, notas) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(semana) DO UPDATE SET peso_promedio = excluded.peso_promedio, energia = excluded.energia,
       sueno = excluded.sueno, notas = excluded.notas`,
    c.semana,
    c.peso_promedio,
    c.energia,
    c.sueno,
    c.notas,
  );

  const profile = await getProfile();
  const checkins = await db.getAllAsync<Checkin>('SELECT * FROM checkins ORDER BY semana');
  const logs = await db.getAllAsync<Log>(
    "SELECT fecha, ejercicio, peso_kg, repeticiones FROM workout_logs WHERE fecha >= date('now', '-42 days')",
  );

  const salud = healthCheck(c.notas);
  const ajustes = [
    salud,
    // Con un síntoma de alerta no toco calorías ni subo cargas.
    salud ? null : profile && calorieAdjustment(profile.objetivo, checkins),
    recoveryAdjustment(checkins),
    ...(salud ? [] : stalledExercises(logs)),
  ].filter((a): a is Ajuste => a != null);

  for (const a of ajustes) {
    await db.runAsync('INSERT INTO coach_adjustments (tipo, detalle) VALUES (?, ?)', a.tipo, a.detalle);
    if (a.deltaCalorias && profile) {
      const calorias = profile.calorias + a.deltaCalorias;
      // El ajuste sale de los carbohidratos; proteína y grasa se mantienen.
      const carbohidratos_g = Math.max(0, profile.carbohidratos_g + Math.round(a.deltaCalorias / 4));
      await db.runAsync(
        'UPDATE coach_profile SET calorias = ?, carbohidratos_g = ?, updated_at = datetime(\'now\') WHERE id = 1',
        calorias,
        carbohidratos_g,
      );
    }
  }
  return ajustes;
}

export async function listAdjustments() {
  const db = await getDb();
  return db.getAllAsync<{ fecha: string; tipo: string; detalle: string }>(
    'SELECT fecha, tipo, detalle FROM coach_adjustments ORDER BY id DESC LIMIT 10',
  );
}

const MENU_SYSTEM = `Eres nutricionista para una persona en Perú. Arma un menú de UN día con comida peruana sencilla
y accesible (mercado o bodega). Formato:
Desayuno / Almuerzo / Cena / Snack, cada uno con porciones en gramos y sus kcal y proteína aproximadas.
Sé breve: una o dos líneas por comida.
Al final: total del día y una lista de compras corta.
Prohibido: déficits extremos, ayunos prolongados y suplementos de riesgo.`;

export async function generateMenu(p: Profile, opts: Pick<AiOptions, 'onPartial' | 'signal'> = {}) {
  const { text } = await askAi(
    [
      { role: 'system', content: MENU_SYSTEM },
      {
        role: 'user',
        content: `Objetivo: ${p.calorias} kcal, ${p.proteina_g} g proteína, ${p.grasa_g} g grasa, ${p.carbohidratos_g} g carbohidratos.
No como: ${p.alimentos_excluidos || 'nada en especial'}.`,
      },
    ],
    { maxTokens: 650, temperature: 0.6, ...opts },
  );
  const db = await getDb();
  await db.runAsync('INSERT INTO meal_plans (contenido) VALUES (?)', text);
  return text;
}

export async function lastMenu() {
  const db = await getDb();
  const row = await db.getFirstAsync<{ contenido: string }>('SELECT contenido FROM meal_plans ORDER BY id DESC LIMIT 1');
  return row?.contenido ?? null;
}
