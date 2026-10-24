import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/ui/bar-chart';
import { Card, Empty, Muted, Overline, Row, useModule, usePalette } from '@/components/ui/kit';
import { Spacing } from '@/constants/theme';
import { tendencia, weeklyVolume, weightSeries, type Punto } from '@/lib/coach/progress';
import { progressData } from '@/lib/coach/repository';

function cambio(valor: number | null, unidad: string) {
  if (valor === null) return 'Necesito al menos dos semanas';
  if (valor === 0) return 'Igual que al inicio';
  return `${valor > 0 ? '+' : ''}${valor.toLocaleString('es-PE')} ${unidad} desde la primera semana`;
}

// Gráficas de las últimas 8 semanas: mi peso promedio y el volumen que levanto.
export function ProgressCard() {
  const p = usePalette();
  const m = useModule('coach');
  const [peso, setPeso] = useState<Punto[]>([]);
  const [volumen, setVolumen] = useState<Punto[]>([]);

  useFocusEffect(
    useCallback(() => {
      progressData().then(({ checkins, logs }) => {
        setPeso(weightSeries(checkins));
        setVolumen(weeklyVolume(logs));
      });
    }, []),
  );

  if (peso.length === 0 && volumen.length === 0) {
    return (
      <Card title="Mi progreso" subtitle="Últimas 8 semanas" icon="chart-bar" accent={m.solid}>
        <Empty icon="chart-bar" color={m.solid} text="Registra tus series y tu peso semanal para ver aquí cómo avanzas." />
      </Card>
    );
  }

  const minPeso = peso.length ? Math.floor(Math.min(...peso.map((x) => x.valor)) - 1) : 0;
  return (
    <Card title="Mi progreso" subtitle="Últimas 8 semanas" icon="chart-bar" accent={m.solid}>
      {peso.length > 0 ? (
        <View style={{ gap: Spacing.two }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Overline>Peso promedio</Overline>
            <Muted size={12}>{cambio(tendencia(peso), 'kg')}</Muted>
          </Row>
          <BarChart data={peso} color={m.solid} unidad=" kg" base={minPeso} />
        </View>
      ) : null}
      {volumen.length > 0 ? (
        <View style={{ gap: Spacing.two }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Overline>Volumen (kg × reps)</Overline>
            <Muted size={12}>{cambio(tendencia(volumen), 'kg')}</Muted>
          </Row>
          <BarChart data={volumen} color={p.primary} />
        </View>
      ) : null}
    </Card>
  );
}
