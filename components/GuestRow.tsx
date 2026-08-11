import { StyleSheet, Text, View } from 'react-native';

import { RsvpBadge } from '@/components/RsvpBadge';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Guest } from '@/types/event';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export function GuestRow({ guest }: { guest: Guest }) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)' }]}>
      <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
        {guest.name}
      </Text>
      <RsvpBadge status={guest.status} />
    </View>
  );
}

/**
 * Same row dimensions as the real row above. The real GuestRow has no avatar —
 * just a name line and a status pill — so this doesn't invent one either,
 * to avoid a height jump once real rows render.
 */
export function GuestRowSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton height={15} width={140} radius={4} />
      <Skeleton width={64} height={22} radius={themeRadius.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  name: {
    flex: 1,
    fontSize: 15,
  },
});
