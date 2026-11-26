import Feather from '@expo/vector-icons/Feather';
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
 * context (menu preference once confirmed) and the status badge. A pending
 * guest's badge says where the invitation stands: not sent, sent or seen. Rows sit inside one card, separated by hairlines.
 */
export function GuestRow({
  guest,
  showDivider = false,
  coOrganizer = false,
}: {
  guest: Guest;
  showDivider?: boolean;
  coOrganizer?: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const inviteStage: 'seen' | 'sent' | 'notSent' =
    guest.inviteSeenAt !== null ? 'seen' : guest.whatsappSentAt !== null ? 'sent' : 'notSent';
  const pendingBadge = {
    seen: { icon: 'eye' as const, label: t('event.inviteStageSeen'), fg: tokens.accentText, bg: tokens.accentTint },
    sent: { icon: 'check' as const, label: t('event.inviteStageSent'), fg: tokens.statusPending, bg: tokens.statusPendingSoft },
    notSent: { icon: 'clock' as const, label: t('event.inviteStageNotSent'), fg: tokens.textSecondary, bg: tokens.surface2 },
  }[inviteStage];

  const tone =
    guest.status === 'pending'
      ? pendingBadge
      : guest.status === 'confirmed'
        ? { bg: tokens.statusConfirmedSoft, fg: tokens.statusConfirmed }
        : guest.status === 'maybe'
          ? { bg: tokens.accentTint, fg: tokens.accentText }
          : { bg: tokens.statusDeclinedSoft, fg: tokens.statusDeclined };

  const detail = coOrganizer
    ? t('home.coOrganizer')
    : guest.status === 'pending'
      ? guest.phone === null
        ? t('event.noPhone')
        : null
      : guest.status === 'confirmed' && guest.partySize !== null
        ? [t('venue.book.people', { count: guest.partySize }), guest.bookingTime, guest.bookingCode]
            .filter((part): part is string => part !== null && part.length > 0)
            .join(' · ')
      : guest.status !== 'declined' && guest.plusOne
        ? t('spontaneous.dashboard.withPlusOne')
        : guest.status === 'confirmed' && guest.dietaryPreferences.length > 0
          ? guest.dietaryPreferences.join(', ')
          : null;

  // A guest with no real name falls back to their phone number as `name`.
  const initials = guest.name === guest.phone ? '#' : initialsOf(guest.name);

  return (
    <View style={[styles.row, showDivider && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
      <View style={[styles.avatar, { backgroundColor: tone.bg }]}>
        <Text maxFontSizeMultiplier={1.2} style={[styles.avatarText, { color: tone.fg }]}>{initials}</Text>
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
      {guest.status === 'pending' ? (
        <View style={[styles.stage, { backgroundColor: pendingBadge.bg }]}>
          <Feather name={pendingBadge.icon} size={12} color={pendingBadge.fg} />
          <Text style={[styles.stageText, { color: pendingBadge.fg }]}>{pendingBadge.label}</Text>
        </View>
      ) : (
        <RsvpBadge status={guest.status} />
      )}
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
  stage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 24,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: themeRadius.pill,
    flexShrink: 1,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});
