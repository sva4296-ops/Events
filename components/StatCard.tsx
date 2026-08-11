import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

interface StatCardProps {
  label: string;
  value: number;
  tint: string;
  background: string;
}

export function StatCard({ label, value, tint, background }: StatCardProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      <Text style={[styles.value, { color: tint }]}>{value}</Text>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: themeRadius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
