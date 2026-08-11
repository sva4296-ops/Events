import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { RsvpStatus } from '@/types/event';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';
import type { ThemeTokens } from '@/utils/themeTokens';

function tones(tokens: ThemeTokens): Record<RsvpStatus, { text: string; background: string }> {
  return {
    confirmed: { text: tokens.statusConfirmed, background: tokens.statusConfirmedSoft },
    pending: { text: tokens.statusPending, background: tokens.statusPendingSoft },
    // A recorded, neutral outcome — not a warning or a destructive action, so
    // this deliberately doesn't use tokens.destructive. Red is reserved for delete.
    declined: { text: tokens.statusDeclined, background: tokens.statusDeclinedSoft },
  };
}

export function RsvpBadge({ status }: { status: RsvpStatus }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const tone = tones(tokens)[status];

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
    borderRadius: themeRadius.pill,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
