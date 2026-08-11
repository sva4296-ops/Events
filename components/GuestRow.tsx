import { StyleSheet, Text, View } from 'react-native';

import { RsvpBadge } from '@/components/RsvpBadge';
import { Skeleton } from '@/components/Skeleton';
import type { Guest } from '@/types/event';
import { colors, radius, spacing } from '@/utils/theme';

export function GuestRow({ guest }: { guest: Guest }) {
  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>
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
      <Skeleton width={64} height={22} radius={radius.pill} />
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
    borderBottomColor: colors.border,
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
});
