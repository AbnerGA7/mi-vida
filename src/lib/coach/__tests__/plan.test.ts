// Pruebas de los números, la rutina y las reglas de ajuste del Coach. Correr con: bun test
import { describe, expect, test } from 'bun:test';

import { calorieAdjustment, healthCheck, recoveryAdjustment, stalledExercises, type Checkin, type Log } from '@/lib/coach/adjust';
import { activityFactor, bmr, computeTargets, type ProfileInput } from '@/lib/coach/nutrition';
import { adaptToInjuries, buildRoutine, todaySession } from '@/lib/coach/routine';

const YO: ProfileInput = { edad: 25, sexo: 'hombre', estatura_cm: 175, peso_kg: 80, objetivo: 'grasa', dias_por_semana: 4 };

describe('calorías y macros', () => {
  test('Mifflin-St Jeor para hombre y mujer', () => {
    expect(bmr(YO)).toBe(1773.75);
    expect(bmr({ ...YO, sexo: 'mujer' })).toBe(1607.75);
  });

  test('el factor de actividad sube con los días de entreno', () => {
    expect([1, 3, 5, 6].map(activityFactor)).toEqual([1.2, 1.375, 1.55, 1.725]);
  });

  test('para bajar grasa aplica el déficit y más proteína', () => {
    const t = computeTargets(YO);
    expect(t.calorias).toBe(Math.round(1773.75 * 1.55 * 0.82));
    expect(t.proteina_g).toBe(176);
    expect(t.grasa_g).toBe(72);
    expect(t.proteina_g * 4 + t.grasa_g * 9 + t.carbohidratos_g * 4).toBeCloseTo(t.calorias, -1);
  });

  test('el déficit nunca baja del metabolismo basal', () => {
    const sedentaria: ProfileInput = { edad: 30, sexo: 'mujer', estatura_cm: 155, peso_kg: 50, objetivo: 'grasa', dias_por_semana: 1 };
    const t = computeTargets(sedentaria);
    expect(t.calorias).toBe(t.bmr);
  });
});

describe('rutina', () => {
  test('elige la división según los días', () => {
    expect(buildRoutine(3).division).toBe('Cuerpo completo');
    expect(buildRoutine(4).division).toBe('Torso / Pierna');
    expect(buildRoutine(6).sesiones).toHaveLength(6);
  });

  test('con rodilla lesionada no quedan sentadillas ni zancadas', () => {
    const r = adaptToInjuries(buildRoutine(3), 'me duele la rodilla');
    const nombres = r.sesiones.flatMap((s) => s.ejercicios.map((e) => e.nombre));
    expect(nombres).not.toContain('Sentadilla');
    expect(nombres).not.toContain('Zancadas');
    expect(nombres).toContain('Prensa');
  });

  test('sin lesiones la rutina queda igual', () => {
    const r = buildRoutine(4);
    expect(adaptToInjuries(r, null)).toBe(r);
  });

  test('la sesión de hoy rota cada día', () => {
    const r = buildRoutine(4);
    expect(todaySession(r, new Date(2026, 0, 1)).nombre).not.toBe(todaySession(r, new Date(2026, 0, 2)).nombre);
  });
});

describe('reglas de ajuste', () => {
  const semanas = (pesos: number[]): Checkin[] => pesos.map((p, i) => ({ semana: `2026-W${40 + i}`, peso_promedio: p, energia: 7, sueno: 7 }));

  test('peso estancado 2 semanas al bajar grasa resta 150 kcal', () => {
    expect(calorieAdjustment('grasa', semanas([80, 80, 80]))?.deltaCalorias).toBe(-150);
    expect(calorieAdjustment('grasa', semanas([81, 80.5, 80]))).toBeNull();
  });

  test('sin subir de peso al ganar masa suma 150 kcal', () => {
    expect(calorieAdjustment('masa', semanas([70, 70, 70]))?.deltaCalorias).toBe(150);
  });

  test('energía o sueño bajos quitan volumen', () => {
    const malas = [{ semana: 'a', peso_promedio: null, energia: 3, sueno: 6 }, { semana: 'b', peso_promedio: null, energia: 4, sueno: 6 }];
    expect(recoveryAdjustment(malas)?.tipo).toBe('volumen');
  });

  test('un ejercicio sin progreso en 3 sesiones se marca', () => {
    const logs: Log[] = ['01', '03', '05', '07'].map((d) => ({ fecha: `2026-10-${d}`, ejercicio: 'Press banca', peso_kg: 60, repeticiones: 8 }));
    expect(stalledExercises(logs)).toHaveLength(1);
    logs.push({ fecha: '2026-10-09', ejercicio: 'Press banca', peso_kg: 62.5, repeticiones: 8 });
    expect(stalledExercises(logs)).toHaveLength(0);
  });

  test('un síntoma de alerta pide ir al médico', () => {
    expect(healthCheck('sentí mareo en la sentadilla')?.tipo).toBe('salud');
    expect(healthCheck('todo bien')).toBeNull();
  });
});
