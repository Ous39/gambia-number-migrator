import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusBar, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import { getJson, keys, setJson } from './services/storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';
export type Tone = 'primary' | 'secondary' | 'blue' | 'teal' | 'gold' | 'warning' | 'danger' | 'success' | 'muted' | 'violet';

// OceanBrown product system: calm navy foundations with an electric-blue action
// colour. Purple remains a supporting product accent, rather than carrying every
// state in the interface.
export const lightPalette = {
  isDark: false,
  bg: '#F4F7FB',
  bg2: '#E9EEF7',
  surface: '#FFFFFF',
  surface2: '#F7F9FC',
  surface3: '#E9EEF7',
  card: '#FFFFFF',
  cardStrong: '#FFFFFF',
  text: '#101828', title: '#071A33', muted: '#3F4D63', softText: '#596A82',
  line: '#E4EAF2', border: '#D0D9E6', primary: '#1769FF', primary2: '#0B4FD7',
  primarySoft: '#EAF1FF', secondary: '#3448A5', secondarySoft: '#EEF0FF',
  teal: '#0797A6',
  tealSoft: '#E5FAFD',
  blue: '#276EF1',
  blueSoft: '#EAF2FF',
  violet: '#7A4BC2', violetSoft: '#F1EAFE',
  gold: '#FF8A1F',
  goldSoft: '#FFF2E6',
  warning: '#FF8A1F',
  warningSoft: '#FFF2E6',
  danger: '#E5484D',
  dangerSoft: '#FFECEF',
  success: '#16865B', successSoft: '#E9F8F1',
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#071A33', brandTop: '#071A33', brandMid: '#0C2E5B', brandBottom: '#1769FF',
  brandBubble: 'rgba(255,255,255,0.16)',
} as const;

export const darkPalette = {
  isDark: true,
  bg: '#07111F', bg2: '#0A1729', surface: '#0E2038', surface2: '#132A47', surface3: '#1A3658', card: '#0E2038', cardStrong: '#132A47',
  text: '#F5F8FC',
  title: '#FFFFFF',
  muted: '#B8C5D8', softText: '#91A3BA',
  line: 'rgba(203,218,238,0.13)',
  border: 'rgba(203,218,238,0.22)',
  primary: '#69A0FF', primary2: '#A8C7FF', primarySoft: 'rgba(46,117,255,0.20)', secondary: '#9DA9FF', secondarySoft: 'rgba(108,122,255,0.16)',
  teal: '#37D1EA',
  tealSoft: 'rgba(55,209,234,0.14)',
  blue: '#6FA0FF',
  blueSoft: 'rgba(111,160,255,0.15)',
  violet: '#C1A3FF', violetSoft: 'rgba(153,111,235,0.18)',
  gold: '#FFB36B',
  goldSoft: 'rgba(255,179,107,0.15)',
  warning: '#FFB36B',
  warningSoft: 'rgba(255,179,107,0.15)',
  danger: '#FF8E97',
  dangerSoft: 'rgba(255,142,151,0.15)',
  success: '#58D39B', successSoft: 'rgba(44,194,126,0.16)',
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#000000',
  brandTop: '#071A33', brandMid: '#0C2E5B', brandBottom: '#1769FF',
  brandBubble: 'rgba(255,255,255,0.13)',
} as const;

export type AppColors = typeof lightPalette | typeof darkPalette;

export const radius = { xs: 7, sm: 10, md: 14, lg: 18, xl: 22, xxl: 28, pill: 999 } as const;

export function getTone(colors: AppColors, tone: Tone = 'primary') {
  if (tone === 'secondary') return { fg: colors.secondary, bg: colors.secondarySoft, border: colors.secondary };
  if (tone === 'blue') return { fg: colors.blue, bg: colors.blueSoft, border: colors.blue };
  if (tone === 'teal') return { fg: colors.teal, bg: colors.tealSoft, border: colors.teal };
  if (tone === 'violet') return { fg: colors.violet, bg: colors.violetSoft, border: colors.violet };
  if (tone === 'gold' || tone === 'warning') return { fg: colors.gold, bg: colors.goldSoft, border: colors.gold };
  if (tone === 'danger') return { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger };
  if (tone === 'success') return { fg: colors.success, bg: colors.successSoft, border: colors.success };
  if (tone === 'muted') return { fg: colors.muted, bg: colors.surface2, border: colors.border };
  return { fg: colors.primary, bg: colors.primarySoft, border: colors.primary };
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    screen: { flex: 1, backgroundColor: colors.bg },
    content: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    scrollContent: { flexGrow: 1, paddingBottom: 28 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 6, paddingBottom: 14 },
    headerLeft: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.softText, fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' },
    title: { color: colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.45 },
    largeTitle: { color: colors.text, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8 },
    heading: { color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '900', letterSpacing: -0.25 },
    subheading: { color: colors.muted, fontSize: 16, lineHeight: 24, fontWeight: '600' },
    body: { color: colors.muted, fontSize: 16, lineHeight: 24, fontWeight: '500' },
    small: { color: colors.softText, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    label: { color: colors.softText, fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.15, textTransform: 'uppercase' },
    sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', marginBottom: 12 },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: 16, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.16 : 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
    softCard: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 14 },
    glassCard: { backgroundColor: colors.cardStrong, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.23 : 0.10, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4 },
    input: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 14, color: colors.text, fontSize: 16 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
    progressTrack: { height: 12, borderRadius: radius.pill, backgroundColor: colors.surface3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
    badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: colors.isDark ? 'rgba(14,32,56,0.97)' : 'rgba(255,255,255,0.97)', borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: 6, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.35 : 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18 },
  });
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const usableWidth = Math.min(width, 760);
  const horizontalPadding = width < 360 ? 14 : width < 430 ? 18 : 24;
  const contentWidth = Math.max(0, usableWidth - horizontalPadding * 2);
  const compact = width < 370 || height < 700;
  const columns = width >= 720 ? 3 : 2;
  const maxWidth = width >= 760 ? 680 : '100%';
  return { width, height, usableWidth, horizontalPadding, contentWidth, compact, columns, isTablet: width >= 720, maxWidth };
}

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  colors: AppColors;
  styles: ReturnType<typeof makeStyles>;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleMode: () => Promise<void>;
  tone: (tone?: Tone) => ReturnType<typeof getTone>;
};

const fallbackColors = lightPalette;
const fallbackStyles = makeStyles(fallbackColors);
const fallbackValue: ThemeContextValue = {
  mode: 'system',
  resolvedMode: 'light',
  colors: fallbackColors,
  styles: fallbackStyles,
  setMode: async () => undefined,
  toggleMode: async () => undefined,
  tone: (tone?: Tone) => getTone(fallbackColors, tone)
};

const ThemeContext = createContext<ThemeContextValue>(fallbackValue);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const device = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    getJson<{ themeMode?: ThemeMode }>(keys.preferences, {})
      .then((prefs) => {
        if (prefs.themeMode === 'light' || prefs.themeMode === 'dark' || prefs.themeMode === 'system') setModeState(prefs.themeMode);
      })
      .catch(() => undefined);
  }, []);

  const resolvedMode: ResolvedThemeMode = mode === 'system' ? (device === 'dark' ? 'dark' : 'light') : mode;
  const colors = resolvedMode === 'dark' ? darkPalette : lightPalette;
  const styles = useMemo(() => makeStyles(colors), [resolvedMode]);

  async function setMode(next: ThemeMode) {
    setModeState(next);
    const prefs = await getJson<Record<string, unknown>>(keys.preferences, {}).catch(() => ({}));
    await setJson(keys.preferences, { ...prefs, themeMode: next }).catch(() => undefined);
  }

  async function toggleMode() {
    await setMode(resolvedMode === 'dark' ? 'light' : 'dark');
  }

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    resolvedMode,
    colors,
    styles,
    setMode,
    toggleMode,
    tone: (tone?: Tone) => getTone(colors, tone)
  }), [mode, resolvedMode, styles]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar barStyle={resolvedMode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      {children}
    </ThemeContext.Provider>
  );
}

export const ThemeProvider = AppThemeProvider;
export function useAppTheme(): ThemeContextValue { return useContext(ThemeContext); }
export const colors = lightPalette;
export const styles = fallbackStyles;
