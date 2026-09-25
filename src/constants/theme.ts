import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    // --- ERA APP-FÄRGER ---
    textMain: '#333333',
    textMuted: '#757575',
    beigeBg: '#F5F4EE',
    beigeBgDarker: '#E8E5D9', 
    cardBg: '#FFFFFF',
    primary: '#4A5D4E',       // Den mörkgröna knappen
    accent: '#C87B4E',        // Den orangea/bruna accentfärgen
    mapPlaceholder: '#D6E5D0',
    border: '#E0E0E0',
    danger: '#D32F2F',        // Logga ut-röd
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    // --- ERA APP-FÄRGER (Mörkt läge) ---
    textMain: '#E0E0E0',
    textMuted: '#A0A0A0',
    beigeBg: '#1E1E1E',       
    beigeBgDarker: '#121212',
    cardBg: '#2C2C2C',
    primary: '#5C7361',       
    accent: '#D99166',
    mapPlaceholder: '#3A4A3A',
    border: '#444444',
    danger: '#CF6679',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
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