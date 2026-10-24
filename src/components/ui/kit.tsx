// Kit de UI de Mi Vida: todas las pantallas usan estas piezas para verse consistentes.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useState,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomTabInset,
  Colors,
  Font,
  ModuleColors,
  Motion,
  Radius,
  Shadow,
  Spacing,
  Type,
  type ModuleKey,
} from '@/constants/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type Palette = Record<keyof (typeof Colors)['light'], string>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function usePalette(): Palette & { dark: boolean } {
  const dark = useColorScheme() === 'dark';
  return { ...Colors[dark ? 'dark' : 'light'], dark };
}

export function useModule(key: ModuleKey) {
  const { dark } = usePalette();
  const m = ModuleColors[key];
  return { solid: m.solid, soft: dark ? m.softDark : m.soft, gradient: m.gradient };
}

// Agrega transparencia a un color hex (#RRGGBB) con alfa entre 0 y 1.
export function alpha(hex: string, a: number) {
  return `${hex.slice(0, 7)}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

// Oscurece un color hex para el final de un degradado.
function shade(hex: string, amount = 0.22) {
  const n = parseInt(hex.slice(1, 7), 16);
  const f = (c: number) => Math.round(c * (1 - amount));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Escala con resorte al presionar: la base de todo lo que se toca.
function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(to, Motion.press);
    },
    onPressOut: () => {
      scale.value = withSpring(1, Motion.press);
    },
  };
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const p = usePalette();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? p.text} />;
}

// Aparece desde abajo con un pequeño retraso según su posición.
export function Appear({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(80 + index * Motion.stagger)
        .springify()
        .damping(20)
        .stiffness(170)}
      style={[{ gap: Spacing.three }, style]}>
      {children}
    </Animated.View>
  );
}

const HERO_RADIUS = 32;
const HERO_OVERLAP = 28;
const COMPACT_HEIGHT = 52;

// Pantalla con portada en degradado del módulo y encabezado compacto que aparece al hacer scroll.
export function Screen({
  module,
  icon,
  title,
  eyebrow,
  subtitle,
  hero,
  children,
  refreshControl,
  right,
}: {
  module: ModuleKey;
  icon: IconName;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  hero?: ReactNode;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  right?: ReactNode;
}) {
  const p = usePalette();
  const m = ModuleColors[module];
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // La portada se desliza un poco más lento que el scroll y se desvanece.
  const heroContent = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 160], [1, 0.25], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [-120, 0, 200], [-30, 0, 60], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [-120, 0], [1.06, 1], Extrapolation.CLAMP) },
    ],
  }));
  const orbs = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, 200], [0, 40], Extrapolation.CLAMP) }],
  }));
  const compact = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [90, 150], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [90, 150], [-8, 0], Extrapolation.CLAMP) }],
  }));

  const refresh = refreshControl
    ? cloneElement(refreshControl, {
        tintColor: '#FFFFFF',
        colors: [m.solid],
        progressBackgroundColor: p.backgroundElement,
        progressViewOffset: insets.top,
      })
    : undefined;

  const items = Children.toArray(children);

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <StatusBar style="light" />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.five }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refresh}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={m.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + Spacing.three }]}>
          <Animated.View style={[StyleSheet.absoluteFill, orbs]} pointerEvents="none">
            <View style={[styles.orb, { width: 260, height: 260, top: -90, right: -80 }]} />
            <View style={[styles.orb, { width: 160, height: 160, bottom: -50, left: -40, opacity: 0.6 }]} />
            <View style={[styles.orbRing, { width: 120, height: 120, top: insets.top + 40, right: 36 }]} />
          </Animated.View>

          <Animated.View style={[{ gap: Spacing.three }, heroContent]}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <MaterialCommunityIcons name={icon} size={22} color="#FFFFFF" />
              </View>
              {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
              <View style={{ flex: 1 }} />
              {right}
            </View>
            <View style={{ gap: Spacing.one }}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
            </View>
            {hero}
          </Animated.View>
        </LinearGradient>

        <View style={styles.content}>
          {items.map((child, i) => (
            <Appear key={isValidElement(child) && child.key != null ? child.key : i} index={i}>
              {child}
            </Appear>
          ))}
        </View>
      </Animated.ScrollView>

      <Animated.View pointerEvents="none" style={[styles.compact, { height: insets.top + COMPACT_HEIGHT }, compact]}>
        <LinearGradient colors={[m.gradient[1], m.gradient[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <View style={[styles.compactRow, { marginTop: insets.top }]}>
          <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />
          <Text style={styles.compactTitle} numberOfLines={1}>
            {title}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

type CardVariant = 'default' | 'tinted' | 'outline';

export function Card({
  title,
  subtitle,
  icon,
  accent,
  right,
  children,
  style,
  variant = 'default',
}: {
  title?: string;
  subtitle?: string;
  icon?: IconName;
  accent?: string;
  right?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
}) {
  const p = usePalette();
  const c = accent ?? p.primary;
  const surface: ViewStyle =
    variant === 'tinted'
      ? { backgroundColor: alpha(c, p.dark ? 0.12 : 0.08), borderColor: alpha(c, p.dark ? 0.22 : 0.14) }
      : variant === 'outline'
        ? { backgroundColor: 'transparent', borderColor: p.border }
        : {
            backgroundColor: p.backgroundElement,
            borderColor: p.border,
            boxShadow: p.dark ? undefined : Shadow.light.card,
          };
  return (
    <View style={[styles.card, surface, style]}>
      {title ? (
        <View style={styles.cardHeader}>
          {icon ? (
            <View style={[styles.cardIcon, { backgroundColor: alpha(c, p.dark ? 0.18 : 0.12) }]}>
              <MaterialCommunityIcons name={icon} size={18} color={c} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={[Type.title, { color: p.text }]} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={[Type.caption, { color: p.textSecondary }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  color,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const press = usePressScale();
  const base = color ?? p.primary;
  const bg = { primary: base, secondary: p.backgroundSelected, ghost: 'transparent', danger: alpha(p.danger, 0.12) }[variant];
  const fg = { primary: '#FFFFFF', secondary: p.text, ghost: base, danger: p.danger }[variant];
  const off = disabled || loading;
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={[
        styles.button,
        size === 'sm' ? styles.buttonSm : null,
        { backgroundColor: bg, opacity: disabled ? 0.45 : 1 },
        variant === 'primary' && !p.dark ? { boxShadow: `0px 8px 20px -8px ${alpha(base, 0.7)}` } : null,
        press.style,
        style,
      ]}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={[base, shade(base)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={size === 'sm' ? 18 : 20} color={fg} /> : null}
          <Text style={[size === 'sm' ? styles.buttonLabelSm : styles.buttonLabel, { color: fg }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

// Botón redondo solo con ícono.
export function IconButton({
  icon,
  onPress,
  color,
  accessibilityLabel,
  tone = 'default',
}: {
  icon: IconName;
  onPress: () => void;
  color?: string;
  accessibilityLabel: string;
  tone?: 'default' | 'hero';
}) {
  const p = usePalette();
  const press = usePressScale(0.9);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={6}
      style={[styles.iconButton, { backgroundColor: tone === 'hero' ? 'rgba(255,255,255,0.18)' : p.backgroundSelected }, press.style]}>
      <MaterialCommunityIcons name={icon} size={20} color={tone === 'hero' ? '#FFFFFF' : (color ?? p.text)} />
    </AnimatedPressable>
  );
}

export function Input({ icon, style, accent, onFocus, onBlur, ...props }: TextInputProps & { icon?: IconName; accent?: string }) {
  const p = usePalette();
  const [focus, setFocus] = useState(false);
  const c = accent ?? p.primary;
  return (
    <View
      style={[
        styles.input,
        {
          backgroundColor: focus ? p.backgroundElement : p.backgroundSelected,
          borderColor: focus ? c : 'transparent',
          boxShadow: focus ? `0px 0px 0px 4px ${alpha(c, 0.14)}` : undefined,
        },
      ]}>
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={focus ? c : p.textSecondary} /> : null}
      <TextInput
        placeholderTextColor={p.textTertiary}
        selectionColor={c}
        cursorColor={c}
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[styles.inputText, { color: p.text }, style]}
        {...props}
      />
    </View>
  );
}

// Botón redondo de micrófono: late con ondas mientras escucha.
export function MicButton({ escuchando, onPress, color }: { escuchando: boolean; onPress: () => void; color?: string }) {
  const p = usePalette();
  const press = usePressScale(0.9);
  const pulse = useSharedValue(0);
  const c = escuchando ? p.danger : (color ?? p.primary);

  useEffect(() => {
    if (escuchando) {
      pulse.value = 0;
      pulse.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: Motion.fast });
    }
  }, [escuchando, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: escuchando ? interpolate(pulse.value, [0, 1], [0.45, 0]) : 0,
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.7]) }],
  }));

  return (
    <View style={styles.micWrap}>
      <Animated.View pointerEvents="none" style={[styles.mic, styles.micRing, { backgroundColor: c }, ring]} />
      <AnimatedPressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityLabel={escuchando ? 'Dejar de escuchar' : 'Hablar'}
        accessibilityRole="button"
        style={[styles.mic, press.style]}>
        <LinearGradient colors={[c, shade(c)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 26 }]} />
        <MaterialCommunityIcons name={escuchando ? 'stop' : 'microphone'} size={24} color="#FFFFFF" />
      </AnimatedPressable>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  icon?: IconName;
}) {
  const p = usePalette();
  const press = usePressScale(0.94);
  const c = color ?? p.primary;
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c : p.backgroundSelected,
          borderColor: selected ? c : 'transparent',
        },
        press.style,
      ]}>
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={selected ? '#FFFFFF' : p.textSecondary} /> : null}
      <Text style={[Type.callout, { color: selected ? '#FFFFFF' : p.text, fontFamily: selected ? Font.semibold : Font.medium }]}>
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
    </AnimatedPressable>
  );
}

// Control segmentado con indicador que se desliza.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  color,
}: {
  options: { label: string; value: T; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
  color?: string;
}) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const seg = width ? (width - 8) / options.length : 0;

  useEffect(() => {
    x.value = withSpring(index * seg, Motion.gentle);
  }, [index, seg, x]);

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const c = color ?? p.primary;

  return (
    <View style={[styles.segmented, { backgroundColor: p.backgroundSelected }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {seg > 0 ? (
        <Animated.View
          style={[
            styles.segIndicator,
            { width: seg, backgroundColor: p.dark ? alpha(c, 0.22) : p.backgroundElement, boxShadow: p.dark ? undefined : Shadow.light.card },
            indicator,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            style={styles.segItem}>
            {o.icon ? <MaterialCommunityIcons name={o.icon} size={16} color={sel ? c : p.textSecondary} /> : null}
            <Text style={[Type.callout, { color: sel ? (p.dark ? '#FFFFFF' : c) : p.textSecondary, fontFamily: sel ? Font.bold : Font.medium }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Barra de progreso que se llena con animación.
export function Progress({ value, color, height = 8, track }: { value: number; color: string; height?: number; track?: string }) {
  const p = usePalette();
  const [w, setW] = useState(0);
  const v = useSharedValue(0);
  const target = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  useEffect(() => {
    v.value = withTiming(target, { duration: Motion.slow });
  }, [target, v]);

  const fill = useAnimatedStyle(() => ({ width: v.value * w }));

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={{ height, borderRadius: height, backgroundColor: track ?? p.backgroundSelected, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, overflow: 'hidden' }, fill]}>
        <LinearGradient colors={[color, shade(color, 0.12)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

export function Badge({ label, color, icon }: { label: string; color: string; icon?: IconName }) {
  const { dark } = usePalette();
  return (
    <View style={[styles.badge, { backgroundColor: alpha(color, dark ? 0.2 : 0.12) }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={12} color={color} /> : null}
      <Text style={[Type.caption, { color, fontFamily: Font.bold }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Stat({
  label,
  value,
  color,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string;
  color?: string;
  icon?: IconName;
  tone?: 'default' | 'hero';
}) {
  const p = usePalette();
  if (tone === 'hero') {
    return (
      <View style={[styles.stat, styles.statHero]}>
        {icon ? <MaterialCommunityIcons name={icon} size={18} color="rgba(255,255,255,0.9)" /> : null}
        <Text style={[Type.h2, { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        <Text style={[Type.caption, { color: 'rgba(255,255,255,0.8)' }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    );
  }
  const c = color ?? p.textSecondary;
  return (
    <View style={[styles.stat, { backgroundColor: p.backgroundSelected }]}>
      {icon ? (
        <View style={[styles.statIcon, { backgroundColor: alpha(c, p.dark ? 0.2 : 0.14) }]}>
          <MaterialCommunityIcons name={icon} size={16} color={c} />
        </View>
      ) : null}
      <Text style={[Type.h2, { color: color ?? p.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[Type.caption, { color: p.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function ListItem({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  onLongPress,
  done,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  done?: boolean;
}) {
  const p = usePalette();
  const c = iconColor ?? p.primary;
  const interactive = !!(onPress || onLongPress);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!interactive}
      android_ripple={interactive ? { color: p.overlay, borderless: false } : undefined}
      style={({ pressed }) => [styles.item, pressed && interactive ? { backgroundColor: p.overlay } : null]}>
      {icon ? (
        <View style={[styles.itemIcon, { backgroundColor: alpha(c, p.dark ? 0.18 : 0.12) }]}>
          <MaterialCommunityIcons name={icon} size={20} color={c} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={[
            Type.bodyStrong,
            { color: done ? p.textTertiary : p.text, textDecorationLine: done ? 'line-through' : 'none' },
          ]}
          numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text style={[Type.caption, { color: p.textSecondary, fontSize: 13, lineHeight: 18 }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          )
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />;
}

export function Empty({ icon, text, color }: { icon: IconName; text: string; color?: string }) {
  const p = usePalette();
  const c = color ?? p.textSecondary;
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: alpha(c, p.dark ? 0.16 : 0.1) }]}>
        <MaterialCommunityIcons name={icon} size={26} color={c} />
      </View>
      <Text style={[Type.callout, { color: p.textSecondary, textAlign: 'center', maxWidth: 260 }]}>{text}</Text>
    </View>
  );
}

// Bloque gris que late mientras algo carga.
export function Skeleton({ height = 16, width = '100%', radius = Radius.sm }: { height?: number; width?: number | `${number}%`; radius?: number }) {
  const p = usePalette();
  const o = useSharedValue(0.5);
  useEffect(() => {
    o.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.5, { duration: 700 })), -1, false);
  }, [o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: p.backgroundSelected }, style]} />;
}

export function Muted({ children, size = 13, center }: { children: ReactNode; size?: number; center?: boolean }) {
  const p = usePalette();
  return (
    <Text style={{ color: p.textSecondary, fontSize: size, lineHeight: size * 1.4, fontFamily: Font.medium, textAlign: center ? 'center' : undefined }}>
      {children}
    </Text>
  );
}

export function Body({ children, color, bold, style }: { children: ReactNode; color?: string; bold?: boolean; style?: StyleProp<TextStyle> }) {
  const p = usePalette();
  return <Text style={[bold ? Type.bodyStrong : Type.body, { color: color ?? p.text }, bold ? { fontFamily: Font.bold } : null, style]}>{children}</Text>;
}

// Número grande para cifras protagonistas (balance, calorías…).
export function Display({ children, color, size = 40 }: { children: ReactNode; color?: string; size?: number }) {
  const p = usePalette();
  return (
    <Text style={[Type.display, { color: color ?? p.text, fontSize: size, lineHeight: size * 1.15 }]} numberOfLines={1} adjustsFontSizeToFit>
      {children}
    </Text>
  );
}

export function Overline({ children, color }: { children: ReactNode; color?: string }) {
  const p = usePalette();
  return <Text style={[Type.overline, { color: color ?? p.textSecondary }]}>{children}</Text>;
}

export function Row({ children, gap = Spacing.two, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

// Aviso en línea (confirmaciones con "Deshacer", errores con "Reintentar").
export function Notice({
  text,
  tone = 'info',
  actionLabel,
  onAction,
  onClose,
}: {
  text: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
}) {
  const p = usePalette();
  const color = { info: p.primary, success: p.success, warning: p.warning, danger: p.danger }[tone];
  const icon: IconName = { info: 'information-outline', success: 'check-circle-outline', warning: 'alert-outline', danger: 'alert-circle-outline' }[tone] as IconName;
  return (
    <View style={[styles.notice, { backgroundColor: color + '18', borderColor: color + '55' }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text style={{ color: p.text, flex: 1, fontSize: 14, lineHeight: 20 }}>{text}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color, fontWeight: '800' }}>{actionLabel}</Text>
        </Pressable>
      ) : null}
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={8}>
          <MaterialCommunityIcons name="close" size={18} color={p.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// Texto que se va escribiendo mientras la IA genera, con cursor.
export function StreamingText({ text, color }: { text: string; color?: string }) {
  const p = usePalette();
  return (
    <Text style={{ color: p.text, fontSize: 15, lineHeight: 22 }}>
      {text}
      <Text style={{ color: color ?? p.primary }}> ▍</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: Spacing.four - 4,
    paddingBottom: Spacing.four + HERO_OVERLAP,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    overflow: 'hidden',
  },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)' },
  orbRing: { position: 'absolute', borderRadius: 999, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, minHeight: 40 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEyebrow: { ...Type.overline, color: 'rgba(255,255,255,0.85)' },
  heroTitle: { ...Type.h1, fontSize: 30, lineHeight: 36, color: '#FFFFFF' },
  heroSubtitle: { ...Type.callout, color: 'rgba(255,255,255,0.85)' },
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three, marginTop: -HERO_OVERLAP },
  compact: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden', justifyContent: 'center' },
  compactRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four - 4, height: COMPACT_HEIGHT },
  compactTitle: { ...Type.title, fontSize: 17, color: '#FFFFFF', flex: 1 },
  card: { borderRadius: Radius.lg + 2, padding: Spacing.three + 2, gap: Spacing.three - 2, borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 4 },
  cardIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    minHeight: 52,
    paddingHorizontal: Spacing.four - 4,
  },
  buttonSm: { minHeight: 40, paddingHorizontal: Spacing.three - 2, borderRadius: Radius.sm + 2 },
  buttonLabel: { fontFamily: Font.bold, fontSize: 15.5, letterSpacing: -0.1 },
  buttonLabelSm: { fontFamily: Font.semibold, fontSize: 14 },
  iconButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    borderWidth: 1.5,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three - 2,
    minHeight: 52,
  },
  inputText: { flex: 1, fontSize: 15.5, fontFamily: Font.medium, paddingVertical: 12 },
  micWrap: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  micRing: { position: 'absolute' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  segmented: { flexDirection: 'row', borderRadius: Radius.md, padding: 4, minHeight: 46 },
  segIndicator: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: Radius.sm + 1 },
  segItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  stat: { flex: 1, borderRadius: Radius.md + 2, padding: Spacing.three - 2, gap: 4 },
  statHero: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  statIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    paddingVertical: Spacing.two,
    marginHorizontal: -Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },
  itemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: Spacing.two + 4, paddingVertical: Spacing.four },
  emptyIcon: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
