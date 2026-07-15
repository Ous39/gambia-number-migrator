import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StatusBar, StyleSheet, useColorScheme, useWindowDimensions } from 'react-native';
import { getJson, keys, setJson } from './services/storage';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedThemeMode = 'light' | 'dark';
export type Tone = 'primary' | 'secondary' | 'blue' | 'teal' | 'gold' | 'warning' | 'danger' | 'success' | 'muted' | 'violet';

// Production purple palette supplied by the product owner.
export const lightPalette = {
  isDark: false,
  bg: '#F5EBFA',
  bg2: '#E7DBEF',
  surface: '#FFFFFF',
  surface2: '#F5EBFA',
  surface3: '#E7DBEF',
  card: '#FFFFFF',
  cardStrong: '#FFFFFF',
  text: '#2E1538', title: '#49225B', muted: '#684F72', softText: '#806A88',
  line: '#E7DBEF', border: '#D6C2E0', primary: '#6E3482', primary2: '#49225B',
  primarySoft: '#E7DBEF', secondary: '#6E3482', secondarySoft: '#F5EBFA',
  teal: '#02A6C5',
  tealSoft: '#E5FAFD',
  blue: '#276EF1',
  blueSoft: '#EAF2FF',
  violet: '#6E3482', violetSoft: '#E7DBEF',
  gold: '#FF8A1F',
  goldSoft: '#FFF2E6',
  warning: '#FF8A1F',
  warningSoft: '#FFF2E6',
  danger: '#E5484D',
  dangerSoft: '#FFECEF',
  success: '#6E3482', successSoft: '#E7DBEF',
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#49225B', brandTop: '#49225B', brandMid: '#6E3482', brandBottom: '#A56ABD',
  brandBubble: 'rgba(255,255,255,0.16)',
} as const;

export const darkPalette = {
  isDark: true,
  bg: '#1B0B22', bg2: '#27102F', surface: '#351642', surface2: '#49225B', surface3: '#5A2A6B', card: '#351642', cardStrong: '#49225B',
  text: '#F6F9FF',
  title: '#FFFFFF',
  muted: '#E7DBEF', softText: '#C9AED5',
  line: 'rgba(217,229,255,0.14)',
  border: 'rgba(217,229,255,0.22)',
  primary: '#D3A8E3', primary2: '#E7DBEF', primarySoft: 'rgba(165,106,189,0.22)', secondary: '#D3A8E3', secondarySoft: 'rgba(165,106,189,0.18)',
  teal: '#37D1EA',
  tealSoft: 'rgba(55,209,234,0.14)',
  blue: '#6FA0FF',
  blueSoft: 'rgba(111,160,255,0.15)',
  violet: '#D3A8E3', violetSoft: 'rgba(165,106,189,0.20)',
  gold: '#FFB36B',
  goldSoft: 'rgba(255,179,107,0.15)',
  warning: '#FFB36B',
  warningSoft: 'rgba(255,179,107,0.15)',
  danger: '#FF8E97',
  dangerSoft: 'rgba(255,142,151,0.15)',
  success: '#D3A8E3', successSoft: 'rgba(165,106,189,0.20)',
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#000000',
  brandTop: '#351642', brandMid: '#49225B', brandBottom: '#6E3482',
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
    body: { color: colors.muted, fontSize: 15, lineHeight: 22, fontWeight: '500' },
    small: { color: colors.softText, fontSize: 12, lineHeight: 17, fontWeight: '700' },
    label: { color: colors.softText, fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.15, textTransform: 'uppercase' },
    sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', marginBottom: 12 },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.xl, padding: 16, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.16 : 0.055, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
    softCard: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 14 },
    glassCard: { backgroundColor: colors.cardStrong, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.23 : 0.10, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 4 },
    input: { minHeight: 54, borderRadius: radius.md, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 14, color: colors.text, fontSize: 16 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    divider: { height: 1, backgroundColor: colors.line, marginVertical: 14 },
    progressTrack: { height: 10, borderRadius: radius.pill, backgroundColor: colors.surface3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.primary },
    badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
    navBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, backgroundColor: colors.isDark ? 'rgba(16,45,38,0.97)' : 'rgba(255,255,255,0.97)', borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: 6, shadowColor: colors.shadow, shadowOpacity: colors.isDark ? 0.35 : 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 18 },
  });
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const usableWidth = Math.min(width, 760);
  const horizontalPadding = width < 360 ? 14 : width < 430 ? 20 : 24;
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
