// Design tokens. One accent colour (sakura pink), semantic colours for light and dark.
// Text and accent colours were picked for at least 4.5:1 contrast on their backgrounds.
import { useColorScheme } from 'react-native';
import { useStore } from './store';

export type Colors = {
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textDim: string;
  textFaint: string;
  accent: string; // fills (buttons) - white text on it
  accentText: string; // pink text / icons on the page background
  accentSoft: string;
  onAccent: string;
  success: string;
  successSoft: string;
  warn: string;
  warnSoft: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
};

export const darkColors: Colors = {
  isDark: true,
  bg: '#0E0F13',
  surface: '#16181E',
  surfaceAlt: '#1F222B',
  border: '#2A2E39',
  text: '#F4F4F7',
  textDim: '#A8ADBA',
  textFaint: '#7F8595',
  accent: '#CF3366',
  accentText: '#FF6B96',
  accentSoft: 'rgba(255,107,150,0.16)',
  onAccent: '#FFFFFF',
  success: '#4ADE80',
  successSoft: 'rgba(74,222,128,0.14)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251,191,36,0.14)',
  danger: '#FF7A7A',
  dangerSoft: 'rgba(255,122,122,0.14)',
  overlay: 'rgba(0,0,0,0.62)',
};

export const lightColors: Colors = {
  isDark: false,
  bg: '#F6F5F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEECF2',
  border: '#E0DDE7',
  text: '#14151A',
  textDim: '#575C69',
  textFaint: '#6B7080',
  accent: '#CF3366',
  accentText: '#C22A5F',
  accentSoft: 'rgba(207,51,102,0.10)',
  onAccent: '#FFFFFF',
  success: '#15803D',
  successSoft: 'rgba(21,128,61,0.10)',
  warn: '#B45309',
  warnSoft: 'rgba(180,83,9,0.10)',
  danger: '#C62828',
  dangerSoft: 'rgba(198,40,40,0.09)',
  overlay: 'rgba(0,0,0,0.45)',
};

export function useColors(): Colors {
  const mode = useStore((s) => s.settings.theme);
  const system = useColorScheme();
  const dark = mode === 'system' ? system !== 'light' : mode === 'dark';
  return dark ? darkColors : lightColors;
}

// Type scale (text follows the phone's font-size setting; layouts must wrap, never clip).
export const T = {
  largeTitle: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const, letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  headline: { fontSize: 17, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
};

// 4-point spacing grid
export const S = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 };
export const R = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const MIN_TOUCH = 48;
