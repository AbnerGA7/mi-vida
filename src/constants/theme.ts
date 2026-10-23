/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Paleta de Mi Vida: verde andino de marca, sol ámbar y fondos cálidos.
export const Colors = {
  light: {
    text: '#0B1F1C',
    background: '#F4F7F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E3ECE8',
    textSecondary: '#5B6B66',
    border: '#E1E8E5',
    primary: '#0F766E',
    primarySoft: '#D5F2EC',
    onPrimary: '#FFFFFF',
    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
  },
  dark: {
    text: '#ECF5F2',
    background: '#0A1211',
    backgroundElement: '#131D1B',
    backgroundSelected: '#1E2B28',
    textSecondary: '#93A6A0',
    border: '#22312E',
    primary: '#2DD4BF',
    primarySoft: '#123A35',
    onPrimary: '#04201C',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
  },
} as const;

// Cada módulo tiene su color para reconocerlo de un vistazo.
export const ModuleColors = {
  hoy: { solid: '#F59E0B', soft: '#FEF3C7', softDark: '#3A2A08' },
  plata: { solid: '#10B981', soft: '#D1FAE5', softDark: '#0C3326' },
  cerebro: { solid: '#8B5CF6', soft: '#EDE9FE', softDark: '#2A1F4A' },
  coach: { solid: '#F43F5E', soft: '#FFE4E6', softDark: '#43151F' },
  ajustes: { solid: '#64748B', soft: '#E2E8F0', softDark: '#1F2937' },
} as const;

export type ModuleKey = keyof typeof ModuleColors;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
