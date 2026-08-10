import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, shadow, spacing } from '@/utils/theme';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadow,
  },
});
