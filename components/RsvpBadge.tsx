import { StyleSheet, Text, View } from 'react-native';

import type { RsvpStatus } from '@/types/event';
import { RSVP_LABEL } from '@/utils/format';
import { colors, radius, spacing } from '@/utils/theme';

const TONES: Record<RsvpStatus, { text: string; background: string }> = {
  confirmed: { text: colors.success, background: colors.successSoft },
  pending: { text: colors.warning, background: colors.warningSoft },
  declined: { text: colors.danger, background: colors.dangerSoft },
};

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  const tone = TONES[status];

  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text }]}>{RSVP_LABEL[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
