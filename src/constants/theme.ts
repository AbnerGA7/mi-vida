/**
 * Sistema de diseño de Mi Vida: colores, tipografía, espaciado, radios, sombras y movimiento.
 * Todas las pantallas lo consumen a través de `src/components/ui/kit.tsx`.
 */

import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

// Paleta: verde andino de marca y sol ámbar, sobre neutros fríos y limpios.
export const Colors = {
  light: {
    text: '#0E1116',
    textSecondary: '#5E6673',
    textTertiary: '#9AA1AD',
    background: '#F4F5F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECEEF2',
    border: 'rgba(14,17,22,0.08)',
    primary: '#0D9488',
    primarySoft: '#D7F3EE',
    onPrimary: '#FFFFFF',
    success: '#12B76A',
    warning: '#F59E0B',
    danger: '#F04438',
    overlay: 'rgba(14,17,22,0.04)',
  },
  dark: {
    text: '#F3F5F9',
    textSecondary: '#9AA3B2',
    textTertiary: '#5E6675',
    background: '#08090C',
    backgroundElement: '#111318',
    backgroundSelected: '#1A1D24',
    border: 'rgba(255,255,255,0.07)',
    primary: '#2DD4BF',
    primarySoft: '#0F2F2B',
    onPrimary: '#04201C',
    success: '#32D583',
    warning: '#FDB022',
    danger: '#F97066',
    overlay: 'rgba(255,255,255,0.04)',
  },
} as const;

// Cada módulo tiene su color y su degradado para reconocerlo de un vistazo.
export const ModuleColors = {
  hoy: { solid: '#F59E0B', gradient: ['#FDB022', '#F97316', '#C2410C'], soft: '#FEF3C7', softDark: '#2A1E06' },
  plata: { solid: '#10B981', gradient: ['#34D399', '#059669', '#065F46'], soft: '#D1FAE5', softDark: '#062A1E' },
  cerebro: { solid: '#8B5CF6', gradient: ['#A78BFA', '#7C3AED', '#4C1D95'], soft: '#EDE9FE', softDark: '#1E1640' },
  coach: { solid: '#F43F5E', gradient: ['#FB7185', '#E11D48', '#881337'], soft: '#FFE4E6', softDark: '#36101A' },
  ajustes: { solid: '#64748B', gradient: ['#2DD4BF', '#0F766E', '#0B3B36'], soft: '#E2E8F0', softDark: '#161B24' },
} as const;

export const BrandGradient = ['#14B8A6', '#0F766E', '#062925'] as const;

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
