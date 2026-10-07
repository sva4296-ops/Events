import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { ScaleTouchable } from '@/components/ScaleTouchable';
import { useTheme } from '@/hooks/useTheme';
import { haptics } from '@/utils/haptics';
import { spacing } from '@/utils/theme';
import { accentButtonShadow, themeRadius, whatsappFill, type ThemeTokens } from '@/utils/themeTokens';

type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tonal'
  | 'whatsapp'
  | 'success'
  | 'danger'
  | 'neutral'
  | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
  /** Optional leading icon (20px, drawn by the caller in `iconColor`). */
  icon?: ReactNode;
}

/**
 * Warm Story 2.0 buttons: pill, 54px (48px for ghost/danger). Colors come
 * from the theme so every variant works in light and dark.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  icon,
}: ButtonProps) {
  const { tokens } = useTheme();
  const look = disabled ? disabledLook(tokens) : variantLook(variant, tokens);
  const glow =
    !disabled && tokens.mode === 'light' && look.glow
      ? { ...accentButtonShadow, shadowColor: tokens.accentFill }
      : undefined;
  const compact = variant === 'ghost' || variant === 'danger';
  // Main calls to action get a light bump; secondary buttons stay silent.
  const bumps = variant === 'primary' || variant === 'success' || variant === 'whatsapp';
  const handlePress = () => {
    if (bumps) haptics.press();
    onPress();
  };

  return (
    <ScaleTouchable
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.base, compact && styles.compact, look.container, glow, style]}
    >
      {icon !== undefined ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.label, variant === 'danger' && styles.labelCompact, look.label]}>{label}</Text>
    </ScaleTouchable>
  );
}

/** Label color for a variant, so callers can tint an `icon` to match. */
export function buttonLabelColor(variant: ButtonVariant, tokens: ThemeTokens): string {
  return (variantLook(variant, tokens).label.color as string | undefined) ?? tokens.textPrimary;
}

interface Look {
  container: ViewStyle;
  label: TextStyle;
  glow?: boolean;
}

function variantLook(variant: ButtonVariant, tokens: ThemeTokens): Look {
  switch (variant) {
    // `success` is only the RSVP "Confirm" — Warm Story keeps it on the accent, not green.
    case 'primary':
    case 'success':
      return {
        container: { backgroundColor: tokens.accentFill },
        label: { color: tokens.onAccent },
        glow: true,
      };
    case 'secondary':
      return {
        container: { backgroundColor: tokens.surface, borderWidth: 1.5, borderColor: tokens.border },
        label: { color: tokens.textPrimary },
      };
    case 'tonal':
      return {
        container: { backgroundColor: tokens.accentTint },
        label: { color: tokens.accentText },
      };
    case 'whatsapp':
      return {
        container: { backgroundColor: whatsappFill },
        label: { color: '#FFFFFF' },
      };
    case 'danger':
      return {
        container: { backgroundColor: tokens.destructiveSoft },
        label: { color: tokens.destructive },
      };
    // A recorded-but-neutral outcome (e.g. "Decline" on the RSVP screen) — not red.
    case 'neutral':
      return {
        container: { backgroundColor: tokens.surface2 },
        label: { color: tokens.textSecondary },
      };
    case 'ghost':
      return {
        container: { backgroundColor: 'transparent' },
        label: { color: tokens.accentText },
      };
  }
}

function disabledLook(tokens: ThemeTokens): Look {
  return {
    container: { backgroundColor: tokens.surface2, borderWidth: 0 },
    label: { color: tokens.textMuted },
  };
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: themeRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: 22,
  },
  compact: {
    minHeight: 48,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 15,
  },
});
