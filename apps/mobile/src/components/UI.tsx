import React, { useState, type ReactNode } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { getTone, radius, type Tone, useAppTheme, useResponsive } from '../appTheme';
import { Button } from './Button';
import { AppIcon } from './AppIcon';

export function Screen({ children, scroll = true, padded = true, stickyTop = true }: { children: ReactNode; scroll?: boolean; padded?: boolean; stickyTop?: boolean }) {
  const { styles } = useAppTheme();
  const r = useResponsive();
  const hasTabs = useShouldShowTabs();
  const insets = useSafeAreaInsets();
  const contentStyle = padded ? { paddingHorizontal: r.horizontalPadding, width: '100%' as const, maxWidth: r.maxWidth as any, alignSelf: 'center' as const } : undefined;
  const bottomPad = hasTabs ? 112 + insets.bottom : 28 + insets.bottom;
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          style={styles.screen}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }, contentStyle]}
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={stickyTop ? [0] : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen, { paddingBottom: bottomPad }, contentStyle]}>{children}</View>
      )}
      <FixedBottomTabs />
    </SafeAreaView>
  );
}

export function ListScreen<T>({
  data,
  keyExtractor,
  renderItem,
  topHeader,
  header,
  footer,
  empty,
}: {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: ({ item, index }: { item: T; index: number }) => ReactNode;
  topHeader?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
}) {
  const { styles, colors } = useAppTheme();
  const r = useResponsive();
  const hasTabs = useShouldShowTabs();
  const insets = useSafeAreaInsets();
  const bottomPad = hasTabs ? 118 + insets.bottom : 34 + insets.bottom;
  const wrapper = { width: '100%' as const, maxWidth: r.maxWidth as any, alignSelf: 'center' as const, paddingHorizontal: r.horizontalPadding };
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      {topHeader ? (
        <View style={{ backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.line, zIndex: 30, elevation: 10 }}>
          <View style={wrapper}>{topHeader}</View>
        </View>
      ) : null}
      <FlatList
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
        data={data}
        keyExtractor={keyExtractor}
        renderItem={({ item, index }) => <View style={wrapper}>{renderItem({ item, index })}</View>}
        ListHeaderComponent={header ? <View style={[wrapper, { paddingTop: 14 }]}>{header}</View> : null}
        ListFooterComponent={footer ? <View style={[wrapper, { paddingTop: 8, paddingBottom: bottomPad }]}>{footer}</View> : <View style={{ height: bottomPad }} />}
        ListEmptyComponent={empty ? <View style={[wrapper, { paddingTop: 16 }]}>{empty}</View> : null}
        contentContainerStyle={{ paddingTop: header ? 0 : 14, paddingBottom: 10 }}
        showsVerticalScrollIndicator={false}
      />
      <FixedBottomTabs />
    </SafeAreaView>
  );
}

function activeTabForPath(pathname: string): 'home' | 'preview' | 'cleanup' | 'history' | 'settings' | null {
  if (pathname === '/dashboard' || pathname === '/') return 'home';
  if (pathname.startsWith('/preview')) return 'preview';
  if (pathname.startsWith('/cleanup')) return 'cleanup';
  if (pathname.startsWith('/history')) return 'history';
  if (pathname.startsWith('/settings')) return 'settings';
  return null;
}

function useShouldShowTabs() {
  const pathname = usePathname();
  return activeTabForPath(pathname) !== null;
}

export function goBackOrHome() {
  try {
    const canGoBack = typeof (router as any).canGoBack === 'function' ? (router as any).canGoBack() : false;
    if (canGoBack) router.back();
    else router.replace('/dashboard');
  } catch {
    router.replace('/dashboard');
  }
}

export function TopNav({
  title = 'NumMigrate GM',
  subtitle,
  back = false,
  right,
  compact = false,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  compact?: boolean;
}) {
  const { colors, styles } = useAppTheme();
  const titleSize = back ? (compact ? 18 : 20) : (compact ? 22 : 24);
  const minHeight = back ? (compact ? 52 : 58) : (compact ? 56 : 66);
  return (
    <View style={{ backgroundColor: colors.bg, paddingTop: 2, paddingBottom: compact ? 6 : 8, borderBottomWidth: 1, borderBottomColor: colors.line, zIndex: 50 }}>
      <View style={[styles.header, { minHeight, paddingTop: 4, paddingBottom: back ? 5 : 9 }]}> 
        <View style={[styles.row, { gap: back ? 8 : 10, flex: 1, minWidth: 0 }]}> 
          {back ? <IconButton icon="left" onPress={goBackOrHome} tone="muted" size={42} /> : null}
          <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
            {!back ? <Text numberOfLines={1} style={[styles.eyebrow, { color: colors.primary }]}>Private • On-device</Text> : null}
            <Text numberOfLines={1} style={[styles.title, { fontSize: titleSize, lineHeight: titleSize + 6, letterSpacing: -0.35 }]}>{title}</Text>
            {subtitle ? <Text numberOfLines={compact ? 1 : 2} style={[styles.small, { marginTop: 1, color: colors.muted }]}>{subtitle}</Text> : null}
          </View>
        </View>
        {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>{right}</View> : null}
      </View>
    </View>
  );
}

export function BackHeader({ title, subtitle, right, compact }: { title: string; subtitle?: string; right?: ReactNode; compact?: boolean }) {
  return <TopNav title={title} subtitle={subtitle} back right={right} compact={compact} />;
}

export function IconButton({ icon, onPress, tone = 'muted', size = 44 }: { icon: string; onPress: () => void; tone?: Tone; size?: number }) {
  const { colors } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={icon}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: size, height: size, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, opacity: pressed ? 0.78 : 1 })}
    >
      <AppIcon name={icon} color={t.fg} size={size > 40 ? 20 : 17} />
    </Pressable>
  );
}
export const CircleButton = IconButton;

export function Section({ title, right, children, style }: { title: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <View style={[{ marginTop: 22 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', letterSpacing: -0.2 }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style, elevated = false, pressable = false, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; elevated?: boolean; pressable?: boolean; onPress?: () => void }) {
  const { styles } = useAppTheme();
  const content = <View style={[elevated ? styles.glassCard : styles.card, style]}>{children}</View>;
  if (!pressable) return content;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>{content}</Pressable>;
}

export function NoticeCard({ title, text, tone = 'primary', icon = 'info', style }: { title: string; text: string; tone?: Tone; icon?: string; style?: StyleProp<ViewStyle> }) {
  const { colors, styles } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <Card style={[{ flexDirection: 'row', gap: 12, marginVertical: 12, backgroundColor: t.bg, borderColor: t.border }, style]}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}>
        <AppIcon name={icon} color={t.fg} size={16} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: t.fg, fontWeight: '900', fontSize: 14 }}>{title}</Text>
        <Text style={[styles.small, { color: colors.muted, marginTop: 4 }]}>{text}</Text>
      </View>
    </Card>
  );
}

export function MetricCard({ label, value, icon, tone = 'primary', helper, onPress }: { label: string; value: string | number; icon: string; tone?: Tone; helper?: string; onPress?: () => void }) {
  const { colors, styles } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <Card pressable={!!onPress} onPress={onPress} style={{ minHeight: 116, padding: 14 }}>
      <View style={[styles.rowBetween, { marginBottom: 10 }]}> 
        <View style={{ width: 42, height: 42, borderRadius: 16, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={icon} color={t.fg} size={19} />
        </View>
        {helper ? <Pill text={helper} tone={tone} /> : onPress ? <AppIcon name="right" color={colors.softText} size={15} /> : null}
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: '900' }}>{value}</Text>
      <Text numberOfLines={2} style={[styles.small, { color: colors.muted }]}>{label}</Text>
    </Card>
  );
}

export function ResponsiveGrid({ children, minItemWidth = 150, gap = 12 }: { children: ReactNode; minItemWidth?: number; gap?: number }) {
  const r = useResponsive();
  const items = React.Children.toArray(children).filter(Boolean);
  const cols = Math.max(1, Math.min(r.isTablet ? 4 : 2, Math.floor((r.contentWidth + gap) / (minItemWidth + gap))));
  const itemWidth = cols <= 1 ? r.contentWidth : (r.contentWidth - gap * (cols - 1)) / cols;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {items.map((child, index) => <View key={index} style={{ width: itemWidth }}>{child}</View>)}
    </View>
  );
}

export function ActionTile({ title, text, icon, onPress, tone = 'primary', disabled = false }: { title: string; text?: string; icon: string; onPress: () => void; tone?: Tone; disabled?: boolean }) {
  const { colors, styles } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      disabled={disabled}
      onPress={onPress}
      style={[styles.card, { minHeight: 116, opacity: disabled ? 0.45 : 1, justifyContent: 'space-between' }]}
    >
      <View style={styles.rowBetween}>
        <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name={icon} color={t.fg} size={19} />
        </View>
        <AppIcon name="right" color={colors.softText} size={16} />
      </View>
      <View style={{ marginTop: 12 }}>
        <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '900', fontSize: 15, lineHeight: 20 }}>{title}</Text>
        {text ? <Text numberOfLines={2} style={[styles.small, { marginTop: 4 }]}>{text}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const { styles } = useAppTheme();
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, percent))}%` }]} /></View>;
}

export function Pill({ text, tone = 'primary' }: { text: string; tone?: Tone }) {
  const { colors, styles } = useAppTheme();
  const t = getTone(colors, tone);
  return <Text numberOfLines={1} style={[styles.badgeText, { color: t.fg, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, overflow: 'hidden' }]}>{text}</Text>;
}

export function EmptyState({ icon = 'info', title, text, action }: { icon?: string; title: string; text: string; action?: ReactNode }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.glassCard, { alignItems: 'center', paddingVertical: 42, marginTop: 16 }]}> 
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primarySoft, borderColor: colors.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
        <AppIcon name={icon} color={colors.primary} size={32} />
      </View>
      <Text style={[styles.heading, { textAlign: 'center', marginTop: 18 }]}>{title}</Text>
      <Text style={[styles.body, { textAlign: 'center', marginTop: 8 }]}>{text}</Text>
      {action ? <View style={{ alignSelf: 'stretch', marginTop: 18 }}>{action}</View> : null}
    </View>
  );
}

export function StepDots({ count, active }: { count: number; active: number }) {
  const { colors } = useAppTheme();
  return <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 }}>{Array.from({ length: count }).map((_, idx) => <View key={idx} style={{ width: idx === active ? 30 : 8, height: 8, borderRadius: radius.pill, backgroundColor: idx === active ? colors.primary : colors.surface3 }} />)}</View>;
}

export function OperatorBadge({ operator }: { operator?: string }) {
  const name = operator || 'Review';
  const lower = name.toLowerCase();
  const tone: Tone = lower.includes('qcell') ? 'violet' : lower.includes('comium') ? 'blue' : lower.includes('africell') ? 'gold' : 'muted';
  return <Pill text={name} tone={tone} />;
}

export function SearchBox({ value, onChangeText, placeholder = 'Search contacts...' }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  const { colors, styles } = useAppTheme();
  return (
    <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 0, minHeight: 54, borderRadius: radius.lg }]}> 
      <AppIcon name="search" color={colors.softText} size={19} />
      <TextInput
        style={{ color: colors.text, fontSize: 16, flex: 1, paddingVertical: 0, fontWeight: '600' }}
        placeholder={placeholder}
        placeholderTextColor={colors.softText}
        value={value}
        onChangeText={onChangeText}
      />
      {value ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => onChangeText('')} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' }}>
          <AppIcon name="close" color={colors.softText} size={16} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function FilterChip({ title, count, active, tone = 'muted', onPress }: { title: string; count?: number; active?: boolean; tone?: Tone; onPress: () => void }) {
  const { colors } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={onPress}
      style={{ minWidth: 88, borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', backgroundColor: active ? t.bg : colors.surface2, borderColor: active ? t.border : colors.line, borderWidth: 1 }}
    >
      <Text style={{ color: active ? t.fg : colors.text, fontWeight: '900', fontSize: 14 }}>{title}</Text>
      {typeof count === 'number' ? <Text style={{ color: active ? t.fg : colors.softText, fontSize: 12, marginTop: 2, fontWeight: '800' }}>{count}</Text> : null}
    </TouchableOpacity>
  );
}

function BottomTabsInner({ active }: { active: 'home' | 'preview' | 'cleanup' | 'history' | 'settings' }) {
  const { colors, styles } = useAppTheme();
  const tabs = [
    { key: 'home', label: 'Home', icon: 'home', path: '/dashboard', center: false },
    { key: 'history', label: 'History', icon: 'history', path: '/history', center: false },
    { key: 'preview', label: 'Migrate', icon: 'plus', path: '/preview', center: true },
    { key: 'cleanup', label: 'Cleanup', icon: 'cleanup', path: '/cleanup', center: false },
    { key: 'settings', label: 'Settings', icon: 'settings', path: '/settings', center: false },
  ] as const;
  return (
    <View style={styles.navBar}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        const center = tab.center;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.84}
            onPress={() => router.replace(tab.path as any)}
          style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: radius.md, backgroundColor: center ? colors.primary : isActive ? colors.primarySoft : 'transparent', borderWidth: 0 }}
          >
            <AppIcon name={tab.icon} color={center ? colors.white : isActive ? colors.primary : colors.softText} size={20} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: center ? colors.white : isActive ? colors.primary : colors.softText, fontSize: 10, lineHeight: 13, fontWeight: '900', marginTop: 3 }}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function FixedBottomTabs() {
  const pathname = usePathname();
  const active = activeTabForPath(pathname);
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  if (!active) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(8, insets.bottom + 6), alignItems: 'center', zIndex: 80, elevation: 30 }}>
      <View style={{ width: '100%', maxWidth: r.maxWidth as any, paddingHorizontal: r.horizontalPadding }}>
        <BottomTabsInner active={active} />
      </View>
    </View>
  );
}

export function FloatingActionBar({ children, aboveTabs = true }: { children: ReactNode; aboveTabs?: boolean }) {
  const r = useResponsive();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: aboveTabs ? Math.max(104, insets.bottom + 104) : Math.max(14, insets.bottom + 10), alignItems: 'center' }}>
      <View style={{ width: '100%', maxWidth: r.maxWidth as any, paddingHorizontal: r.horizontalPadding }}>{children}</View>
    </View>
  );
}

export function BottomTabs(_props: { active: 'home' | 'preview' | 'cleanup' | 'history' | 'settings' }) {
  return null;
}

export function ModeSwitch({ value, onChange }: { value: 'duplicate' | 'replace'; onChange: (value: 'duplicate' | 'replace') => void }) {
  const { colors } = useAppTheme();
  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ color: colors.text, fontWeight: '900' }}>Choose Update Mode</Text>
      <ModeOption title="Add new number and keep old" text="Safest during the transition period." icon="plus" active={value === 'duplicate'} tone="primary" onPress={() => onChange('duplicate')} />
      <ModeOption title="Replace old with new" text="Advanced. Use only after review." icon="update" active={value === 'replace'} tone="warning" onPress={() => onChange('replace')} />
    </Card>
  );
}

function ModeOption({ title, text, icon, active, tone, onPress }: { title: string; text: string; icon: string; active: boolean; tone: Tone; onPress: () => void }) {
  const { colors, styles } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <TouchableOpacity activeOpacity={0.84} onPress={onPress} style={[styles.softCard, { borderColor: active ? t.border : colors.line, backgroundColor: active ? t.bg : colors.surface2 }]}> 
      <View style={[styles.row, { gap: 12 }]}> 
        <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}><AppIcon name={icon} color={t.fg} size={18} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontWeight: '900' }}>{title}</Text>
          <Text style={styles.small}>{text}</Text>
        </View>
        {active ? <Pill text="Active" tone={tone} /> : null}
      </View>
    </TouchableOpacity>
  );
}


export type DialogAction = {
  text: string;
  tone?: Tone;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onPress?: () => void | Promise<void>;
};

type DialogState = {
  visible: boolean;
  title: string;
  message?: string;
  tone?: Tone;
  icon?: string;
  actions?: DialogAction[];
  children?: ReactNode;
};

export function AppDialog({
  visible,
  title,
  message,
  tone = 'primary',
  icon = 'info',
  actions = [{ text: 'OK' }],
  children,
  onClose,
}: DialogState & { onClose: () => void }) {
  const { colors, styles } = useAppTheme();
  const t = getTone(colors, tone);
  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.isDark ? 'rgba(0,0,0,0.68)' : 'rgba(3,18,30,0.30)', justifyContent: 'center', padding: 22 }}>
        <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        <View style={[styles.glassCard, { width: '100%', maxWidth: 430, alignSelf: 'center', padding: 20, borderColor: t.border, backgroundColor: colors.cardStrong }]}>
          <View style={[styles.row, { gap: 14, alignItems: 'flex-start' }]}> 
            <View style={{ width: 48, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, borderColor: t.border, borderWidth: 1 }}>
              <AppIcon name={icon} color={t.fg} size={22} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: colors.text, fontWeight: '900', fontSize: 20, lineHeight: 25 }}>{title}</Text>
              {message ? <Text style={[styles.body, { marginTop: 8 }]}>{message}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.78} style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 }}>
              <AppIcon name="close" color={colors.softText} size={18} />
            </TouchableOpacity>
          </View>
          {children ? <View style={{ marginTop: 16 }}>{children}</View> : null}
          <View style={{ flexDirection: actions.length > 1 ? 'row' : 'column', gap: 10, marginTop: 20 }}>
            {actions.map((a, index) => (
              <Button
                key={`${a.text}-${index}`}
                title={a.text}
                tone={a.tone || tone}
                variant={a.variant || (index === actions.length - 1 ? 'primary' : 'secondary')}
                onPress={async () => { onClose(); await a.onPress?.(); }}
                style={{ flex: actions.length > 1 ? 1 : undefined }}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function useAppDialog() {
  const [state, setState] = useState<DialogState>({ visible: false, title: '' });
  function closeDialog() { setState((current) => ({ ...current, visible: false })); }
  function showDialog(next: Omit<DialogState, 'visible'>) { setState({ ...next, visible: true }); }
  function Dialog() { return <AppDialog {...state} onClose={closeDialog} />; }
  return { showDialog, closeDialog, Dialog };
}
