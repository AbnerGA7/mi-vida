// Kit de UI de Mi Vida: todas las pantallas usan estas piezas para verse consistentes.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
  type RefreshControlProps,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomTabInset, Colors, ModuleColors, Spacing, type ModuleKey } from '@/constants/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export type Palette = Record<keyof (typeof Colors)['light'], string>;

export function usePalette(): Palette & { dark: boolean } {
  const dark = useColorScheme() === 'dark';
  return { ...Colors[dark ? 'dark' : 'light'], dark };
}

export function useModule(key: ModuleKey) {
  const { dark } = usePalette();
  const m = ModuleColors[key];
  return { solid: m.solid, soft: dark ? m.softDark : m.soft };
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const p = usePalette();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? p.text} />;
}

// Pantalla con encabezado de color del módulo.
export function Screen({
  module,
  icon,
  title,
  subtitle,
  children,
  refreshControl,
  right,
}: {
  module: ModuleKey;
  icon: IconName;
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  right?: ReactNode;
}) {
  const p = usePalette();
  const m = ModuleColors[module];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.background }} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[m.solid, shade(m.solid)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name={icon} size={26} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{title}</Text>
              {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        </LinearGradient>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Oscurece un color hex para el final del degradado.
function shade(hex: string, amount = 0.28) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(c * (1 - amount));
  const r = f(n >> 16);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function Card({
  title,
  icon,
  accent,
  right,
  children,
  style,
}: {
  title?: string;
  icon?: IconName;
  accent?: string;
  right?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle;
}) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.backgroundElement, borderColor: p.border }, style]}>
      {title ? (
        <View style={styles.cardHeader}>
          {icon ? (
            <View style={[styles.cardIcon, { backgroundColor: (accent ?? p.primary) + '22' }]}>
              <MaterialCommunityIcons name={icon} size={18} color={accent ?? p.primary} />
            </View>
          ) : null}
          <Text style={[styles.cardTitle, { color: p.text }]}>{title}</Text>
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
  loading,
  disabled,
  color,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  style?: ViewStyle;
}) {
  const p = usePalette();
  const base = color ?? p.primary;
  const bg = { primary: base, secondary: p.backgroundSelected, ghost: 'transparent', danger: p.danger + '1A' }[variant];
  const fg = { primary: '#FFFFFF', secondary: p.text, ghost: base, danger: p.danger }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <MaterialCommunityIcons name={icon} size={20} color={fg} /> : null}
          <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Input({ icon, style, ...props }: TextInputProps & { icon?: IconName }) {
  const p = usePalette();
  return (
    <View style={[styles.input, { backgroundColor: p.background, borderColor: p.border }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={p.textSecondary} /> : null}
      <TextInput placeholderTextColor={p.textSecondary} style={[styles.inputText, { color: p.text }, style]} {...props} />
    </View>
  );
}

// Botón redondo de micrófono: se pone rojo mientras escucha.
export function MicButton({ escuchando, onPress, color }: { escuchando: boolean; onPress: () => void; color?: string }) {
  const p = usePalette();
  const c = escuchando ? p.danger : (color ?? p.primary);
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={escuchando ? 'Dejar de escuchar' : 'Hablar'}
      style={({ pressed }) => [styles.mic, { backgroundColor: c, transform: [{ scale: pressed ? 0.94 : escuchando ? 1.06 : 1 }] }]}>
      <MaterialCommunityIcons name={escuchando ? 'stop' : 'microphone'} size={24} color="#FFFFFF" />
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected: boolean; onPress: () => void; color?: string }) {
  const p = usePalette();
  const c = color ?? p.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? c : p.backgroundSelected, borderColor: selected ? c : p.border }]}>
      <Text style={{ color: selected ? '#FFFFFF' : p.text, fontWeight: selected ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Progress({ value, color, height = 8 }: { value: number; color: string; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: p.backgroundSelected, overflow: 'hidden' }}>
      <View style={{ height, borderRadius: height, width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }} />
    </View>
  );
}

export function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Stat({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: IconName }) {
  const p = usePalette();
  return (
    <View style={[styles.stat, { backgroundColor: p.background, borderColor: p.border }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={color ?? p.textSecondary} /> : null}
      <Text style={{ color: p.textSecondary, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: color ?? p.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
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
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.item, { opacity: pressed && (onPress || onLongPress) ? 0.7 : 1 }]}>
      {icon ? (
        <View style={[styles.itemIcon, { backgroundColor: (iconColor ?? p.primary) + '1F' }]}>
          <MaterialCommunityIcons name={icon} size={18} color={iconColor ?? p.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          typeof subtitle === 'string' ? (
            <Text style={{ color: p.textSecondary, fontSize: 13 }} numberOfLines={2}>
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

export function Empty({ icon, text }: { icon: IconName; text: string }) {
  const p = usePalette();
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name={icon} size={32} color={p.textSecondary} />
      <Text style={{ color: p.textSecondary, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function Muted({ children, size = 13 }: { children: ReactNode; size?: number }) {
  const p = usePalette();
  return <Text style={{ color: p.textSecondary, fontSize: size }}>{children}</Text>;
}

export function Body({ children, color, bold }: { children: ReactNode; color?: string; bold?: boolean }) {
  const p = usePalette();
  return <Text style={{ color: color ?? p.text, fontSize: 15, lineHeight: 22, fontWeight: bold ? '700' : '400' }}>{children}</Text>;
}

export function Row({ children, gap = Spacing.two, style }: { children: ReactNode; gap?: number; style?: ViewStyle }) {
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.three,
  },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: BottomTabInset + Spacing.six + Spacing.four },
  hero: { borderRadius: 24, padding: Spacing.four, marginBottom: Spacing.one },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  heroSubtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  card: { borderRadius: 20, padding: Spacing.three + 2, gap: Spacing.two + 2, borderWidth: StyleSheet.hairlineWidth },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  cardIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', flex: 1 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
  },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
  },
  inputText: { flex: 1, fontSize: 16, paddingVertical: 13 },
  mic: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  chip: { borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 1 },
  badge: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10 },
  stat: { flex: 1, borderRadius: 16, padding: Spacing.three, gap: 2, borderWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  itemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
});
