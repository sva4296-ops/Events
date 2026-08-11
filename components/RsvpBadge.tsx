import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { RsvpStatus } from '@/types/event';
import { colors, radius, spacing } from '@/utils/theme';

const TONES: Record<RsvpStatus, { text: string; background: string }> = {
  confirmed: { text: colors.success, background: colors.successSoft },
  pending: { text: colors.warning, background: colors.warningSoft },
  // A recorded, neutral outcome — not a warning or a destructive action, so
  // this deliberately doesn't use colors.danger. Red is reserved for delete.
  declined: { text: colors.declined, background: colors.declinedSoft },
};

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  const { t } = useTranslation();
  const tone = TONES[status];

  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text }]}>{t(`common.${status}`)}</Text>
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
