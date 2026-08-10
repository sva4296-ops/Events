import { StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';

import { guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';

type GuestButtonVariant = 'purple' | 'gold' | 'outline';

interface GuestButtonProps {
  label: string;
  onPress: () => void;
  variant?: GuestButtonVariant;
  style?: ViewStyle;
}

export function GuestButton({ label, onPress, variant = 'purple', style }: GuestButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={[styles.base, variants[variant], style]}
    >
      <Text style={[styles.label, labels[variant]]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: gSpace.xl,
    ...gShadow,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
});

const variants: Record<GuestButtonVariant, ViewStyle> = StyleSheet.create({
  purple: { backgroundColor: guest.purple },
  gold: { backgroundColor: guest.gold },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: guest.purple,
    shadowOpacity: 0,
    elevation: 0,
  },
});

const labels: Record<GuestButtonVariant, { color: string }> = {
  purple: { color: guest.white },
  gold: { color: guest.ink },
  outline: { color: guest.purple },
};
