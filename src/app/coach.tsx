import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, Spacing } from '@/constants/theme';
import type { Log } from '@/lib/coach/adjust';
import type { Objetivo, Sexo } from '@/lib/coach/nutrition';
import {
  generateMenu,
  getProfile,
  lastMenu,
  lastSetFor,
  listAdjustments,
  logSet,
  saveCheckin,
  saveProfile,
  setsToday,
  type Profile,
} from '@/lib/coach/repository';
import { adaptToInjuries, buildRoutine, todaySession, type Ejercicio } from '@/lib/coach/routine';
import { today } from '@/lib/finance/quick-capture';

type C = Record<keyof (typeof Colors)['light'], string>;

function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}

const num = (s: string) => Number(s.replace(',', '.'));

export default function CoachScreen() {
  const c = Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  const cargar = useCallback(async () => setProfile(await getProfile()), []);
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>💪 Coach</Text>
        {profile === undefined && <ActivityIndicator />}
        {profile === null && <Onboarding c={c} onSaved={cargar} />}
        {profile && <Plan c={c} profile={profile} onChanged={cargar} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Onboarding({ c, onSaved }: { c: C; onSaved: () => void }) {
  const [f, setF] = useState({ edad: '', estatura: '', peso: '', dias: '4', lesiones: '', excluidos: '' });
  const [sexo, setSexo] = useState<Sexo>('hombre');
  const [objetivo, setObjetivo] = useState<Objetivo>('grasa');
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function guardar() {
    const datos = { edad: num(f.edad), estatura_cm: num(f.estatura), peso_kg: num(f.peso), dias_por_semana: num(f.dias) };
    if (Object.values(datos).some((v) => !Number.isFinite(v) || v <= 0)) {
      Alert.alert('Faltan datos', 'Completa edad, estatura, peso y días por semana.');
      return;
    }
    await saveProfile({ ...datos, sexo, objetivo, lesiones: f.lesiones, alimentos_excluidos: f.excluidos });
    onSaved();
  }

  return (
    <Card c={c} title="Cuéntame de ti">
      <Field c={c} label="Edad" value={f.edad} onChange={set('edad')} numeric />
      <Field c={c} label="Estatura (cm)" value={f.estatura} onChange={set('estatura')} numeric />
      <Field c={c} label="Peso (kg)" value={f.peso} onChange={set('peso')} numeric />
      <Field c={c} label="Días de gym por semana" value={f.dias} onChange={set('dias')} numeric />
      <Chips c={c} options={['hombre', 'mujer'] as const} value={sexo} onChange={setSexo} />
      <Chips
        c={c}
        options={['grasa', 'masa', 'mantener'] as const}
        labels={{ grasa: 'Bajar grasa', masa: 'Ganar masa', mantener: 'Mantener' }}
        value={objetivo}
        onChange={setObjetivo}
      />
      <Field c={c} label="Lesiones (ej. rodilla, hombro)" value={f.lesiones} onChange={set('lesiones')} />
      <Field c={c} label="Alimentos que no como" value={f.excluidos} onChange={set('excluidos')} />
      <Button c={c} label="Calcular mi plan" onPress={guardar} />
    </Card>
  );
}

function Plan({ c, profile, onChanged }: { c: C; profile: Profile; onChanged: () => void }) {
  const rutina = adaptToInjuries(buildRoutine(profile.dias_por_semana), profile.lesiones);
  const sesion = todaySession(rutina);
  const [hechas, setHechas] = useState<(Log & { serie: number })[]>([]);
  const [ajustes, setAjustes] = useState<{ fecha: string; detalle: string }[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    const [s, a, m] = await Promise.all([setsToday(today()), listAdjustments(), lastMenu()]);
    setHechas(s);
    setAjustes(a);
    setMenu(m);
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  async function nuevoMenu() {
    setGenerando(true);
    try {
      setMenu(await generateMenu(profile));
    } catch (e) {
      Alert.alert('No pude armar el menú', e instanceof Error ? e.message : String(e));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <>
      <Card c={c} title="Mis números">
        <Text style={[styles.big, { color: c.text }]}>{profile.calorias} kcal</Text>
        <Text style={{ color: c.textSecondary }}>
          Proteína {profile.proteina_g} g · Grasa {profile.grasa_g} g · Carbohidratos {profile.carbohidratos_g} g
        </Text>
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          Mifflin-St Jeor × actividad ({profile.dias_por_semana} días), ajustado a tu objetivo.
        </Text>
      </Card>

      <Card c={c} title={`Hoy: ${sesion.nombre}`}>
        <Text style={{ color: c.textSecondary, fontSize: 13 }}>
          {rutina.division}. {rutina.motivo} Calienta 5-10 min antes.
        </Text>
        {sesion.ejercicios.map((ej) => (
          <ExerciseRow
            key={ej.nombre}
            c={c}
            ej={ej}
            hechas={hechas.filter((h) => h.ejercicio === ej.nombre).length}
            onLogged={cargar}
          />
        ))}
        <Text style={{ color: c.textSecondary, fontSize: 12 }}>
          Progresión: si completas todas las series en el tope de reps, sube 2.5 kg la próxima vez.
        </Text>
      </Card>

      <WeeklyCheckin c={c} onSaved={() => Promise.all([cargar(), onChanged()])} />

      {ajustes.length > 0 && (
        <Card c={c} title="Ajustes a mi plan">
          {ajustes.map((a, i) => (
            <Text key={i} style={{ color: c.text }}>
              {a.fecha} · {a.detalle}
            </Text>
          ))}
        </Card>
      )}

      <Card c={c} title="Menú del día">
        {menu && <Text style={{ color: c.text }}>{menu}</Text>}
        <Button c={c} label={generando ? 'Armando…' : menu ? 'Otro menú' : 'Armar mi menú'} onPress={nuevoMenu} disabled={generando} />
      </Card>
    </>
  );
}

function ExerciseRow({ c, ej, hechas, onLogged }: { c: C; ej: Ejercicio; hechas: number; onLogged: () => void }) {
  const [peso, setPeso] = useState('');
  const [reps, setReps] = useState('');
  const [anterior, setAnterior] = useState<Log | null>(null);

  useFocusEffect(
    useCallback(() => {
      lastSetFor(ej.nombre).then(setAnterior);
    }, [ej.nombre]),
  );

  async function guardar() {
    if (!(num(peso) >= 0) || !(num(reps) > 0)) return;
    await logSet({ fecha: today(), ejercicio: ej.nombre, serie: hechas + 1, peso_kg: num(peso), repeticiones: num(reps) });
    setReps('');
    onLogged();
  }

  return (
    <View style={styles.exercise}>
      <View style={styles.row}>
        <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{ej.nombre}</Text>
        <Text style={{ color: hechas >= ej.series ? '#3A9D5D' : c.textSecondary }}>
          {hechas}/{ej.series}
        </Text>
      </View>
      <Text style={{ color: c.textSecondary, fontSize: 12 }}>
        {ej.series}×{ej.reps} · descanso {ej.descanso} · alternativa: {ej.alternativa}
        {anterior ? ` · última vez ${anterior.peso_kg} kg × ${anterior.repeticiones}` : ''}
      </Text>
      <View style={styles.row}>
        <TextInput value={peso} onChangeText={setPeso} placeholder="kg" keyboardType="decimal-pad" placeholderTextColor={c.textSecondary} style={[styles.small, { color: c.text, borderColor: c.backgroundSelected }]} />
        <TextInput value={reps} onChangeText={setReps} placeholder="reps" keyboardType="number-pad" placeholderTextColor={c.textSecondary} style={[styles.small, { color: c.text, borderColor: c.backgroundSelected }]} />
        <Pressable onPress={guardar} style={[styles.smallButton, { backgroundColor: c.text }]}>
          <Text style={{ color: c.background, fontWeight: '600' }}>+ Serie</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WeeklyCheckin({ c, onSaved }: { c: C; onSaved: () => void }) {
  const [f, setF] = useState({ peso: '', energia: '', sueno: '', notas: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  async function guardar() {
    const ajustes = await saveCheckin({
      semana: isoWeek(),
      peso_promedio: f.peso ? num(f.peso) : null,
      energia: f.energia ? num(f.energia) : null,
      sueno: f.sueno ? num(f.sueno) : null,
      notas: f.notas,
    });
    Alert.alert(
      'Registro guardado',
      ajustes.length ? ajustes.map((a) => `• ${a.detalle}`).join('\n') : 'Vas bien: no hace falta cambiar nada.',
    );
    setF({ peso: '', energia: '', sueno: '', notas: '' });
    onSaved();
  }

  return (
    <Card c={c} title={`Registro semanal (${isoWeek()})`}>
      <Field c={c} label="Peso promedio de la semana (kg)" value={f.peso} onChange={set('peso')} numeric />
      <Field c={c} label="Energía (1-10)" value={f.energia} onChange={set('energia')} numeric />
      <Field c={c} label="Sueño (1-10)" value={f.sueno} onChange={set('sueno')} numeric />
      <Field c={c} label="Notas (dolor, cómo te sentiste)" value={f.notas} onChange={set('notas')} />
      <Button c={c} label="Guardar y ajustar plan" onPress={guardar} />
    </Card>
  );
}

function Card({ c, title, children }: { c: C; title: string; children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: c.backgroundElement }]}>
      <Text style={[styles.h2, { color: c.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ c, label, value, onChange, numeric }: { c: C; label: string; value: string; onChange: (v: string) => void; numeric?: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={label}
      placeholderTextColor={c.textSecondary}
      keyboardType={numeric ? 'decimal-pad' : 'default'}
      style={[styles.input, { color: c.text, borderColor: c.backgroundSelected }]}
    />
  );
}

function Chips<T extends string>({
  c,
  options,
  labels,
  value,
  onChange,
}: {
  c: C;
  options: readonly T[];
  labels?: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onChange(o)} style={[styles.chip, { backgroundColor: o === value ? c.text : c.backgroundSelected }]}>
          <Text style={{ color: o === value ? c.background : c.text }}>{labels?.[o] ?? o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Button({ c, label, onPress, disabled }: { c: C; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.button, { backgroundColor: c.text, opacity: disabled ? 0.6 : 1 }]}>
      <Text style={[styles.buttonLabel, { color: c.background }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.four },
  h1: { fontSize: 28, fontWeight: '700' },
  h2: { fontSize: 18, fontWeight: '600' },
  big: { fontSize: 34, fontWeight: '700' },
  card: { borderRadius: 16, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: { borderWidth: 1, borderRadius: 12, padding: Spacing.three, fontSize: 16 },
  small: { borderWidth: 1, borderRadius: 10, padding: Spacing.two, fontSize: 16, flex: 1 },
  smallButton: { borderRadius: 10, paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.three },
  button: { borderRadius: 12, paddingVertical: Spacing.three, alignItems: 'center' },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  exercise: { gap: Spacing.one, paddingVertical: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderRadius: 999, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
});
