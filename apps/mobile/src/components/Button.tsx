import type { ReactNode } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { getTone, radius, type Tone, useAppTheme } from '../appTheme';
import { AppIcon } from './AppIcon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  tone = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  children,
}: {
  title?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  tone?: Tone;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { colors } = useAppTheme();
  const t = getTone(colors, variant === 'danger' ? 'danger' : tone);
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';
  const backgroundColor = isPrimary ? colors.primary : isDanger ? colors.dangerSoft : isGhost ? 'transparent' : t.bg;
  const borderColor = isPrimary ? colors.primary : isDanger ? colors.danger : isGhost ? 'transparent' : t.border;
  const textColor = isPrimary ? colors.white : isDanger ? colors.danger : t.fg;

  return (
    <TouchableOpacity
      activeOpacity={0.84}
      onPress={loading || disabled ? undefined : onPress}
      style={[
        {
          minHeight: 54,
          borderRadius: radius.md,
          paddingHorizontal: 18,
          paddingVertical: 13,
          backgroundColor,
          borderWidth: 1,
          borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.48 : 1,
          shadowColor: colors.shadow,
          shadowOpacity: isPrimary ? (colors.isDark ? 0.24 : 0.16) : 0,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: isPrimary ? 3 : 0,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={textColor} style={{ marginRight: title ? 10 : 0 }} /> : icon && icon !== 'right' ? <AppIcon name={icon} color={textColor} size={17} style={{ marginRight: title ? 10 : 0 }} /> : null}
      {title ? <Text numberOfLines={2} maxFontSizeMultiplier={1.25} style={{ color: textColor, fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center', flexShrink: 1 }}>{title}</Text> : children}
      {!loading && title && icon === 'right' ? <AppIcon name="right" color={textColor} size={20} style={{ marginLeft: 10 }} /> : null}
    </TouchableOpacity>
  );
}
