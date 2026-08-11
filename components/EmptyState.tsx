import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';

/** The one empty-state treatment used everywhere: soft card, centered muted text. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <Text style={[styles.message, { color: tokens.textSecondary }]}>{message}</Text>
      {action !== undefined ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.lg,
    paddingVertical: gSpace.xxl,
    paddingHorizontal: gSpace.xl,
    alignItems: 'center',
    gap: gSpace.lg,
    borderWidth: 1,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
  },
});
