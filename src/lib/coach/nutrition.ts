// Calorías y macros calculados con fórmulas, nunca con la IA.

export type Sexo = 'hombre' | 'mujer';
export type Objetivo = 'grasa' | 'masa' | 'mantener';

export type ProfileInput = {
  edad: number;
  sexo: Sexo;
  estatura_cm: number;
  peso_kg: number;
  objetivo: Objetivo;
  dias_por_semana: number;
};

export type Targets = {
  bmr: number;
  tdee: number;
  calorias: number;
  proteina_g: number;
  grasa_g: number;
  carbohidratos_g: number;
};

// Mifflin-St Jeor.
export function bmr({ edad, sexo, estatura_cm, peso_kg }: ProfileInput) {
  return 10 * peso_kg + 6.25 * estatura_cm - 5 * edad + (sexo === 'hombre' ? 5 : -161);
}

export function activityFactor(dias: number) {
  if (dias <= 1) return 1.2;
  if (dias <= 3) return 1.375;
  if (dias <= 5) return 1.55;
  return 1.725;
}

const AJUSTE_OBJETIVO: Record<Objetivo, number> = {
  grasa: 0.82, // déficit ~18%
  masa: 1.07, // superávit ~7%
  mantener: 1,
};

export function computeTargets(p: ProfileInput): Targets {
  const base = bmr(p);
  const tdee = base * activityFactor(p.dias_por_semana);
  // Nunca bajo de mi metabolismo basal: un déficit más grande ya es una dieta extrema.
  const calorias = Math.round(Math.max(tdee * AJUSTE_OBJETIVO[p.objetivo], base));

  const proteina_g = Math.round(p.peso_kg * (p.objetivo === 'grasa' ? 2.2 : 2));
  const grasa_g = Math.round(p.peso_kg * 0.9);
  const restante = calorias - proteina_g * 4 - grasa_g * 9;
  const carbohidratos_g = Math.max(0, Math.round(restante / 4));

  return { bmr: Math.round(base), tdee: Math.round(tdee), calorias, proteina_g, grasa_g, carbohidratos_g };
}
