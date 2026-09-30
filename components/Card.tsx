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
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          borderWidth: 1,
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
    borderRadius: themeRadius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
});
