import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: tokens.surfaceBorder ?? 'transparent',
          borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
        },
        tokens.surfaceElevatedShadow ?? undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
