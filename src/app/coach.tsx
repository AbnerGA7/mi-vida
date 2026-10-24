import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ProgressCard } from '@/components/coach/progress-card';
import { Badge, Body, Button, Card, Display, Input, ListItem, Muted, Overline, Progress, Row, Screen, Segmented, Skeleton, Stat, useModule, usePalette } from '@/components/ui/kit';
import { Spacing, Type } from '@/constants/theme';
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
import { isoWeek } from '@/lib/coach/progress';
import { scheduleWeeklyCheckinReminder } from '@/lib/coach/reminder';
import { today } from '@/lib/finance/quick-capture';

const num = (s: string) => Number(s.replace(',', '.'));

export default function CoachScreen() {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);

  const cargar = useCallback(async () => {
    const perfil = await getProfile();
    setProfile(perfil);
    // Con un plan armado, me recuerda cada domingo hacer el registro semanal.
    if (perfil) scheduleWeeklyCheckinReminder().catch(() => {});
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const subtitle = profile
    ? { grasa: 'Objetivo: bajar grasa', masa: 'Objetivo: ganar masa', mantener: 'Objetivo: mantener' }[profile.objetivo]
    : 'Tu plan de gym y alimentación';

  return (
    <Screen
      module="coach"
      icon="dumbbell"
      eyebrow="Coach"
      title={profile ? 'Tu plan de hoy' : 'Armemos tu plan'}
      subtitle={subtitle}
      hero={
        profile ? (
          <View style={{ gap: Spacing.three }}>
            <View>
              <Overline color="rgba(255,255,255,0.8)">Meta diaria</Overline>
              <Row gap={6} style={{ alignItems: 'flex-end' }}>
                <Display color="#FFFFFF" size={44}>
                  {profile.calorias.toLocaleString('es-PE')}
                </Display>
                <Text style={[Type.title, { color: 'rgba(255,255,255,0.85)', marginBottom: 8 }]}>kcal</Text>
              </Row>
            </View>
            <Row gap={10}>
              <Stat tone="hero" label="Proteína" value={`${profile.proteina_g} g`} icon="food-steak" />
              <Stat tone="hero" label="Grasa" value={`${profile.grasa_g} g`} icon="water-outline" />
              <Stat tone="hero" label="Carbos" value={`${profile.carbohidratos_g} g`} icon="barley" />
            </Row>
          </View>
        ) : undefined
      }>
      {profile === undefined && (
        <Card>
          <Skeleton height={20} width="50%" />
          <Skeleton height={52} />
          <Skeleton height={52} />
        </Card>
      )}
      {profile === null && <Onboarding onSaved={cargar} />}
      {profile && <Plan profile={profile} onChanged={cargar} />}
    </Screen>
  );
}

function Onboarding({ onSaved }: { onSaved: () => void }) {
  const m = useModule('coach');
  const [f, setF] = useState({ edad: '', estatura: '', peso: '', dias: '4', lesiones: '', excluidos: '' });
  const [sexo, setSexo] = useState<Sexo>('hombre');
  const [objetivo, setObjetivo] = useState<Objetivo>('grasa');
  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

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
    <Card title="Cuéntame de ti" subtitle="Con esto calculo tus calorías y tu rutina" icon="account-heart-outline" accent={m.solid}>
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Input icon="cake-variant-outline" placeholder="Edad" value={f.edad} onChangeText={set('edad')} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input icon="human-male-height" placeholder="cm" value={f.estatura} onChangeText={set('estatura')} keyboardType="decimal-pad" />
        </View>
      </Row>
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Input icon="scale-bathroom" placeholder="kg" value={f.peso} onChangeText={set('peso')} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input icon="calendar-week" placeholder="Días/sem" value={f.dias} onChangeText={set('dias')} keyboardType="number-pad" />
        </View>
      </Row>
      <Overline>Sexo</Overline>
      <Segmented<Sexo>
        value={sexo}
        onChange={setSexo}
        color={m.solid}
        options={[
          { label: 'Hombre', value: 'hombre', icon: 'gender-male' },
          { label: 'Mujer', value: 'mujer', icon: 'gender-female' },
        ]}
      />
      <Overline>Objetivo</Overline>
      <Segmented<Objetivo>
        value={objetivo}
        onChange={setObjetivo}
        color={m.solid}
        options={[
          { label: 'Bajar grasa', value: 'grasa' },
          { label: 'Ganar masa', value: 'masa' },
          { label: 'Mantener', value: 'mantener' },
        ]}
      />
      <Input icon="bandage" placeholder="Lesiones (ej. rodilla, hombro)" value={f.lesiones} onChangeText={set('lesiones')} />
      <Input icon="food-off-outline" placeholder="Alimentos que no como" value={f.excluidos} onChangeText={set('excluidos')} />
      <Button label="Calcular mi plan" icon="calculator-variant-outline" color={m.solid} onPress={guardar} />
    </Card>
  );
}

function Plan({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const p = usePalette();
  const m = useModule('coach');
  const rutina = adaptToInjuries(buildRoutine(profile.dias_por_semana), profile.lesiones);
  const sesion = todaySession(rutina);
  const [hechas, setHechas] = useState<(Log & { serie: number })[]>([]);
  const [ajustes, setAjustes] = useState<{ fecha: string; detalle: string }[]>([]);
  const [menu, setMenu] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);

  const cargar = useCallback(async () => {
    const [s, a, mn] = await Promise.all([setsToday(today()), listAdjustments(), lastMenu()]);
    setHechas(s);
    setAjustes(a);
    setMenu(mn);
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

  const totalSeries = sesion.ejercicios.reduce((s, e) => s + e.series, 0);

  return (
    <>
      <Card
        title={`Hoy: ${sesion.nombre}`}
        subtitle={`${sesion.ejercicios.length} ejercicios · ${totalSeries} series`}
        icon="weight-lifter"
        accent={m.solid}
        right={<Badge label={`${hechas.length}/${totalSeries}`} color={hechas.length >= totalSeries ? p.success : m.solid} />}>
        <Progress value={totalSeries ? hechas.length / totalSeries : 0} color={m.solid} height={10} />
        <Muted>
          {rutina.division}. Calienta 5-10 min antes.
        </Muted>
        {sesion.ejercicios.map((ej) => (
          <ExerciseRow key={ej.nombre} ej={ej} hechas={hechas.filter((h) => h.ejercicio === ej.nombre).length} onLogged={cargar} />
        ))}
        <Muted size={12}>Mifflin-St Jeor × actividad ({profile.dias_por_semana} días), ajustado a tu objetivo.</Muted>
        <Muted size={12}>Progresión: si completas todas las series en el tope de reps, sube 2.5 kg la próxima vez.</Muted>
      </Card>

      <WeeklyCheckin onSaved={() => Promise.all([cargar(), onChanged()])} />

      {/* Se vuelve a montar al registrar una serie o un ajuste, así las barras se actualizan al toque. */}
      <ProgressCard key={`${hechas.length}-${ajustes.length}`} />

      {ajustes.length > 0 && (
        <Card title="Ajustes a mi plan" icon="tune-variant" accent={m.solid}>
          {ajustes.map((a, i) => (
            <ListItem key={i} icon="auto-fix" iconColor={m.solid} title={a.detalle} subtitle={a.fecha} />
          ))}
        </Card>
      )}

      <Card title="Menú del día" subtitle="Peruano, con tus macros" icon="silverware-fork-knife" accent={p.warning}>
        {menu ? <Body>{menu}</Body> : <Muted>Te armo un menú peruano con tus macros y lo que no comes.</Muted>}
        <Button
          label={menu ? 'Otro menú' : 'Armar mi menú'}
          icon="chef-hat"
          variant={menu ? 'secondary' : 'primary'}
          color={p.warning}
          loading={generando}
          onPress={nuevoMenu}
        />
      </Card>
    </>
  );
}

function ExerciseRow({ ej, hechas, onLogged }: { ej: Ejercicio; hechas: number; onLogged: () => void }) {
  const p = usePalette();
  const m = useModule('coach');
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

  const completo = hechas >= ej.series;

  return (
    <View style={{ gap: Spacing.two, paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: p.border }}>
      <ListItem
        icon={completo ? 'check-circle' : 'dumbbell'}
        iconColor={completo ? p.success : m.solid}
        title={ej.nombre}
        subtitle={`${ej.series}×${ej.reps} · ${ej.descanso}${anterior ? ` · última: ${anterior.peso_kg} kg × ${anterior.repeticiones}` : ''}`}
        right={<Badge label={`${hechas}/${ej.series}`} color={completo ? p.success : m.solid} />}
      />
      {!completo && (
        <Row gap={8}>
          <View style={{ flex: 1 }}>
            <Input placeholder="kg" accent={m.solid} value={peso} onChangeText={setPeso} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Input placeholder="reps" accent={m.solid} value={reps} onChangeText={setReps} keyboardType="number-pad" />
          </View>
          <Button label="Serie" icon="plus" color={m.solid} onPress={guardar} style={{ paddingHorizontal: Spacing.three }} />
        </Row>
      )}
    </View>
  );
}

function WeeklyCheckin({ onSaved }: { onSaved: () => void }) {
  const m = useModule('coach');
  const [f, setF] = useState({ peso: '', energia: '', sueno: '', notas: '' });
  const set = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

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
    <Card title="Registro semanal" subtitle="Ajusto tu plan con reglas claras" icon="clipboard-check-outline" accent={m.solid} right={<Badge label={isoWeek()} color={m.solid} />}>
      <Input icon="scale-bathroom" placeholder="Peso promedio de la semana (kg)" value={f.peso} onChangeText={set('peso')} keyboardType="decimal-pad" />
      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Input icon="lightning-bolt-outline" placeholder="Energía 1-10" value={f.energia} onChangeText={set('energia')} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Input icon="sleep" placeholder="Sueño 1-10" value={f.sueno} onChangeText={set('sueno')} keyboardType="number-pad" />
        </View>
      </Row>
      <Input icon="note-edit-outline" placeholder="Notas (dolor, cómo te sentiste)" value={f.notas} onChangeText={set('notas')} />
      <Button label="Guardar y ajustar plan" icon="content-save-outline" color={m.solid} onPress={guardar} />
      <Muted size={12}>Te lo recuerdo cada domingo a las 6 pm.</Muted>
    </Card>
  );
}
