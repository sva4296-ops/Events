import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RsvpBadge } from '@/components/RsvpBadge';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Guest } from '@/types/event';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export function GuestRow({ guest }: { guest: Guest }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  // Only meaningful while the RSVP itself is still pending and there's a
  // phone to message at all — once they've responded, the RsvpBadge already
  // says everything that matters; an email-only invite has no WhatsApp
  // concept to show a status for.
  const showWhatsAppStatus = guest.status === 'pending' && guest.phone !== null;
  const sent = guest.whatsappSentAt !== null;

  return (
    <View style={[styles.row, { borderBottomColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)' }]}>
      <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
        {guest.name}
      </Text>
      <View style={styles.badges}>
        {showWhatsAppStatus ? (
          <View
            style={[
              styles.whatsappBadge,
              { backgroundColor: sent ? tokens.statusConfirmedSoft : tokens.statusPendingSoft },
            ]}
          >
            <Feather
              name={sent ? 'check' : 'clock'}
              size={11}
              color={sent ? tokens.statusConfirmed : tokens.statusPending}
            />
            <Text
              style={[styles.whatsappBadgeText, { color: sent ? tokens.statusConfirmed : tokens.statusPending }]}
            >
              {sent ? t('event.invitedBadge') : t('event.notSentBadge')}
            </Text>
          </View>
        ) : null}
        <RsvpBadge status={guest.status} />
      </View>
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
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  whatsappBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: themeRadius.pill,
  },
  whatsappBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
