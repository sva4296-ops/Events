import { StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';

type GuestButtonVariant = 'purple' | 'gold' | 'outline';

interface GuestButtonProps {
  label: string;
  onPress: () => void;
  variant?: GuestButtonVariant;
  style?: ViewStyle;
}

export function GuestButton({ label, onPress, variant = 'purple', style }: GuestButtonProps) {
  const { tokens } = useTheme();

  const variantStyle: ViewStyle =
    variant === 'purple'
      ? { backgroundColor: tokens.accentPrimary }
      : variant === 'gold'
        ? { backgroundColor: tokens.accentGold }
        : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: tokens.accentPrimary, shadowOpacity: 0, elevation: 0 };

  const labelColor =
    variant === 'purple' ? '#FFFFFF' : variant === 'gold' ? tokens.textPrimary : tokens.accentPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={[styles.base, variantStyle, style]}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: gSpace.xl,
    shadowColor: '#3B2A1F',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});
