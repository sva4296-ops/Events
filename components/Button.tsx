import { StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';

import { colors, shadow, spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'neutral' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={[styles.base, variantStyles[variant], disabled && styles.disabled, style]}
    >
      <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    // Warm Story pass: every variant is fully pill-shaped now, not just the
    // ones that opted in individually before.
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    ...shadow,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = StyleSheet.create({
  // `success` is only ever used for the RSVP screen's "Confirm attendance" —
  // Warm Story spec calls for accentPrimary purple there, not green, so this
  // is a deliberate repurposing of the variant's color, not a bug.
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  success: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger },
  // Same outline shape as `danger`, recolored — for a recorded-but-neutral
  // outcome (e.g. a declined RSVP) that isn't a destructive action. Red stays
  // reserved for `danger`/delete. Also the RSVP screen's "Decline" per the
  // Warm Story spec: soft muted background, textSecondary-toned text, no red.
  neutral: { backgroundColor: colors.declinedSoft, borderWidth: 0 },
  ghost: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
});

const labelStyles: Record<ButtonVariant, { color: string }> = {
  primary: { color: colors.onPrimary },
  secondary: { color: colors.text },
  success: { color: colors.onPrimary },
  danger: { color: colors.danger },
  neutral: { color: colors.declined },
  ghost: { color: colors.muted },
};
