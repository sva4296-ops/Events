import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { RsvpStatus } from '@/types/event';
import { themeRadius } from '@/utils/themeTokens';
import type { ThemeTokens } from '@/utils/themeTokens';

function tones(tokens: ThemeTokens): Record<RsvpStatus, { text: string; background: string }> {
  return {
    confirmed: { text: tokens.statusConfirmed, background: tokens.statusConfirmedSoft },
    pending: { text: tokens.statusPending, background: tokens.statusPendingSoft },
    // Warm Story 2.0 gives declined its own rose tone (tokens.statusDeclined),
    // still separate from tokens.destructive, which stays reserved for delete.
    declined: { text: tokens.statusDeclined, background: tokens.statusDeclinedSoft },
  };
}

/** `label` overrides the status word (e.g. "Răspunde" for a guest's own pending invite). */
export function RsvpBadge({ status, label }: { status: RsvpStatus; label?: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const tone = tones(tokens)[status];

  return (
    <View style={[styles.badge, { backgroundColor: tone.background }]}>
      <View style={[styles.dot, { backgroundColor: tone.text }]} />
      <Text style={[styles.text, { color: tone.text }]}>{label ?? t(`common.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    paddingVertical: 4,
    flexShrink: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
