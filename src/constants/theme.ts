/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Crackem brand colors (same tokens as the What's Crackin' trip site).
export const Colors = {
  light: {
    text: '#1f1a14',
    background: '#f7f5ef',
    backgroundElement: '#ffffff',
    backgroundSelected: '#f1ead9',
    textSecondary: '#6b6256',
    line: '#e2dccf',
    amber: '#c7801a',
    amberInk: '#8a5208',
    hop: '#4f7a2a',
    warn: '#b4471f',
  },
  dark: {
    text: '#f2ebdf',
    background: '#17130f',
    backgroundElement: '#211b15',
    backgroundSelected: '#2c241b',
    textSecondary: '#a89c8a',
    line: '#3a3128',
    amber: '#e6a03a',
    amberInk: '#f0b85e',
    hop: '#8fbf5a',
    warn: '#ef7a52',
  },
} as const;

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
