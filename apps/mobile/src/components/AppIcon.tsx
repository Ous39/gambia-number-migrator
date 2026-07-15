import React from 'react';
import { Text, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../appTheme';

type IonIconName = React.ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, IonIconName> = {
  home: 'home-outline',
  preview: 'eye-outline',
  review: 'eye-outline',
  cleanup: 'trash-outline',
  clean: 'trash-outline',
  trash: 'trash-outline',
  history: 'time-outline',
  settings: 'settings-outline',
  scan: 'scan-outline',
  search: 'search-outline',
  backup: 'cloud-upload-outline',
  cloud: 'cloud-upload-outline',
  contacts: 'people-outline',
  update: 'sync-outline',
  refresh: 'sync-outline',
  check: 'checkmark',
  success: 'checkmark-circle-outline',
  remove: 'trash-outline',
  premium: 'diamond-outline',
  lock: 'lock-closed-outline',
  card: 'card-outline',
  warning: 'warning-outline',
  info: 'information-circle-outline',
  right: 'arrow-forward',
  left: 'chevron-back',
  sun: 'sunny-outline',
  moon: 'moon-outline',
  plus: 'add',
  close: 'close',
  filter: 'filter-outline',
  phone: 'call-outline',
  call: 'call-outline',
  email: 'mail-outline',
  document: 'document-text-outline',
  stats: 'stats-chart-outline',
  spark: 'sparkles-outline',
  shield: 'shield-checkmark-outline',
  dashboard: 'apps-outline',
  notification: 'notifications-outline',
  // Backward-compatible mappings for older glyphs that did not display on some devices.
  '⌂': 'home-outline',
  '⌕': 'search-outline',
  '⌫': 'trash-outline',
  '◷': 'time-outline',
  '⚙': 'settings-outline',
  '☷': 'people-outline',
  '↻': 'sync-outline',
  '✓': 'checkmark',
  '◎': 'eye-outline',
  '☁': 'cloud-upload-outline',
  '◇': 'diamond-outline',
  '🔒': 'lock-closed-outline',
  '💳': 'card-outline',
  '🧰': 'information-circle-outline',
  '↗': 'arrow-up-outline',
};

export function AppIcon({ name, size = 18, color, style }: { name?: string; size?: number; color?: string; style?: TextStyle }) {
  const { colors } = useAppTheme();
  const iconName = name ? ICONS[name] : undefined;
  if (iconName) {
    return <Ionicons name={iconName as any} size={size} color={color || colors.text} style={style} />;
  }
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={1}
      style={[{ color: color || colors.text, fontSize: size, lineHeight: Math.ceil(size * 1.2), fontWeight: '900', textAlign: 'center' }, style]}
    >
      {name || ''}
    </Text>
  );
}
