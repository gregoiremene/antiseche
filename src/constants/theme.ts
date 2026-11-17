/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#18181B',
    background: '#F6F7F9',
    /** surfaces (cartes) : blanches, elles ressortent sur le fond grisé */
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#ECEEF2',
    textSecondary: '#6B7280',
    /** accent des actions principales */
    accent: '#4F46E5',
    accentText: '#FFFFFF',
    /** filet des cartes */
    border: '#E6E8EC',
  },
  dark: {
    text: '#F4F4F5',
    background: '#0C0D10',
    backgroundElement: '#17181C',
    backgroundSelected: '#26272D',
    textSecondary: '#9BA1AC',
    accent: '#7B7CF0',
    accentText: '#0C0D10',
    border: '#26272D',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Palette résolue (light ou dark), valeurs élargies en string. */
export type ThemeColors = { [K in keyof typeof Colors.light]: string };

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

/** Rayons d'arrondi cohérents dans toute l'appli. */
export const Radius = {
  s: 10,
  m: 14,
  l: 20,
  pill: 999,
} as const;

/** Ombre douce pour détacher une carte de son fond. */
export const CardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
