import { StyleSheet, Text, View } from 'react-native';

import { RsvpBadge } from '@/components/RsvpBadge';
import type { Guest } from '@/types/event';
import { colors, spacing } from '@/utils/theme';

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
