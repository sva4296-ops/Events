import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/utils/theme';

interface StatCardProps {
  label: string;
  value: number;
  tint: string;
  background: string;
}

export function StatCard({ label, value, tint, background }: StatCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      <Text style={[styles.value, { color: tint }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radius.md,
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
    color: colors.muted,
  },
});
