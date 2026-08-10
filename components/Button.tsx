import { StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/utils/theme';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

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
    borderRadius: radius.md,
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
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  success: { backgroundColor: colors.success },
  danger: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.danger },
  ghost: { backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
});

const labelStyles: Record<ButtonVariant, { color: string }> = {
  primary: { color: colors.onPrimary },
  secondary: { color: colors.text },
  success: { color: colors.onPrimary },
  danger: { color: colors.danger },
  ghost: { color: colors.muted },
};
