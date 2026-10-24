import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { alpha, usePalette } from '@/components/ui/kit';
import { Font, Motion, Radius, Type } from '@/constants/theme';

type Punto = { etiqueta: string; valor: number };

function Barra({ fraccion, color, index, destacada }: { fraccion: number; color: string; index: number; destacada: boolean }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(index * Motion.stagger, withTiming(fraccion, { duration: Motion.slow }));
  }, [fraccion, h, index]);
  const style = useAnimatedStyle(() => ({ height: `${Math.max(4, h.value * 100)}%` }));
  return <Animated.View style={[styles.bar, { backgroundColor: destacada ? color : alpha(color, 0.35) }, style]} />;
}

// Gráfica de barras simple, sin librerías: la última barra (la semana actual) va destacada.
// Con base, las barras arrancan desde ese valor en vez de cero, para que se note un cambio de peso de 1 kg.
export function BarChart({ data, color, height = 120, unidad = '', base }: { data: Punto[]; color: string; height?: number; unidad?: string; base?: number }) {
  const p = usePalette();
  const max = Math.max(...data.map((d) => d.valor), 1);
  const min = base ?? 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.area, { height }]}>
        {data.map((d, i) => (
          <View key={d.etiqueta} style={styles.col}>
            {i === data.length - 1 ? (
              <Text style={[Type.caption, { color: p.text, fontFamily: Font.bold }]} numberOfLines={1}>
                {d.valor.toLocaleString('es-PE')}
                {unidad}
              </Text>
            ) : null}
            <Barra fraccion={max > min ? (d.valor - min) / (max - min) : 1} color={color} index={i} destacada={i === data.length - 1} />
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {data.map((d) => (
          <Text key={d.etiqueta} style={[Type.caption, styles.label, { color: p.textTertiary }]} numberOfLines={1}>
            {d.etiqueta}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  col: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 },
  bar: { width: '100%', borderRadius: Radius.sm - 4 },
  labels: { flexDirection: 'row', gap: 8 },
  label: { flex: 1, textAlign: 'center', fontSize: 11 },
});
