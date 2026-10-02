import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { ScaleTouchable } from '@/components/ScaleTouchable';

import { RsvpBadge } from '@/components/RsvpBadge';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Invitation } from '@/utils/invitations';
import { EVENT_COVERS } from '@/utils/eventCovers';
import { getEventType } from '@/utils/eventTypes';
import { daysUntilEvent, eventShortSubtitle } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { themeRadius, typeface } from '@/utils/themeTokens';

/**
 * One invitation row. Warm Story 2.0 stacks these inside a single card on
 * Home (see InvitationGroup), separated by hairlines rather than as
 * individual cards.
 */
export function InvitationListItem({
  invitation,
  onPress,
  showDivider = false,
}: {
  invitation: Invitation;
  onPress: () => void;
  /** Hairline above the row — every row after the first in a group. */
  showDivider?: boolean;
}) {
  const { event, guest } = invitation;
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const type = getEventType(event.type);
  const days = daysUntilEvent(event.date);
  const past = days !== null && days < 0;

  return (
    <ScaleTouchable
      scaleTo={0.98}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${guest.status}`}
      style={[
        styles.row,
        showDivider && { borderTopWidth: 1, borderTopColor: tokens.border },
      ]}
    >
      {/* Past event: dim the content, not the row, so the divider stays crisp. */}
      <View style={[styles.content, past && styles.past]}>
      <Image source={EVENT_COVERS[type.id]} style={styles.badge} resizeMode="cover" />

      <View style={styles.info}>
        <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={[styles.date, { color: tokens.textSecondary }]} numberOfLines={1}>
          {eventShortSubtitle(event)}
        </Text>
      </View>

      <RsvpBadge
        status={guest.status}
        label={guest.status === 'pending' ? t('home.respond') : undefined}
      />
      </View>
    </ScaleTouchable>
  );
}

/** The single card that holds Home's invitation rows. */
export function InvitationGroup({ children }: { children: ReactNode }) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.group,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      {children}
    </View>
  );
}

/** Same row/badge/info dimensions as the real row above, so nothing shifts when data lands. */
export function InvitationListItemSkeleton({ showDivider = false }: { showDivider?: boolean }) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.row, showDivider && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
      <Skeleton width={50} height={50} radius={themeRadius.md} />
      <View style={styles.info}>
        <Skeleton height={15} width="65%" radius={4} />
        <Skeleton height={12} width="40%" radius={4} />
      </View>
      <Skeleton width={72} height={24} radius={themeRadius.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 76,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  past: {
    opacity: 0.4,
  },
  badge: {
    width: 50,
    height: 50,
    borderRadius: themeRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  name: {
    fontFamily: typeface.bodyBold,
    fontSize: 16,
  },
  date: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
});
