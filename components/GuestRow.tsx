import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { RsvpBadge } from '@/components/RsvpBadge';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Guest } from '@/types/event';
import { themeRadius } from '@/utils/themeTokens';

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * Warm Story 2.0 guest row: status-tinted initials avatar, name, one line of
 * context (WhatsApp status while pending, menu preference once confirmed)
 * and the RSVP badge. Rows sit inside one card, separated by hairlines.
 */
export function GuestRow({ guest, showDivider = false }: { guest: Guest; showDivider?: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const tone =
    guest.status === 'confirmed'
      ? { bg: tokens.statusConfirmedSoft, fg: tokens.statusConfirmed }
      : guest.status === 'pending'
        ? { bg: tokens.statusPendingSoft, fg: tokens.statusPending }
        : { bg: tokens.statusDeclinedSoft, fg: tokens.statusDeclined };

  const detail =
    guest.status === 'pending'
      ? guest.phone === null
        ? t('event.noPhone')
        : guest.whatsappSentAt !== null
          ? t('event.inviteSent')
          : t('event.inviteNotSent')
      : guest.status === 'confirmed' && guest.dietaryPreferences.length > 0
        ? guest.dietaryPreferences.join(', ')
        : null;

  // A guest with no real name falls back to their phone number as `name`.
  const initials = guest.name === guest.phone ? '#' : initialsOf(guest.name);

  return (
    <View style={[styles.row, showDivider && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
      <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
        <Text style={[styles.avatarText, { color: tone.fg }]}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
          {guest.name}
        </Text>
        {detail !== null ? (
          <Text style={[styles.detail, { color: tokens.textSecondary }]} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
      <RsvpBadge status={guest.status} />
    </View>
  );
}

/** Same row dimensions as the real row above. */
export function GuestRowSkeleton({ showDivider = false }: { showDivider?: boolean }) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.row, showDivider && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
      <Skeleton width={40} height={40} radius={20} />
      <View style={styles.info}>
        <Skeleton height={15} width={140} radius={4} />
        <Skeleton height={12} width={100} radius={4} />
      </View>
      <Skeleton width={84} height={24} radius={themeRadius.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
  },
});
