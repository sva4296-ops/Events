import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { GuestRow, GuestRowSkeleton } from '@/components/GuestRow';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Skeleton } from '@/components/Skeleton';
import { StatCard } from '@/components/StatCard';
import { SwipeableRow } from '@/components/SwipeableRow';
import { confirmDelete } from '@/utils/confirm';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { countRsvps, eventSubtitle } from '@/utils/format';
import { getEventType } from '@/utils/eventTypes';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export default function EventDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, hydrated, removeGuest, isOwner } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);
  const owner = isOwner(event);

  // Before the initial fetch settles, `getEvent` can't tell "still loading"
  // from "no such event" — `hydrated` is what actually distinguishes them.
  if (!hydrated) {
    return (
      <Screen>
        <View style={styles.headerSkeleton}>
          <Skeleton width={40} height={40} radius={themeRadius.pill} />
          <Skeleton height={28} width="70%" radius={6} />
          <Skeleton height={15} width="45%" radius={4} />
        </View>

        <View style={styles.stats}>
          <Skeleton height={78} radius={themeRadius.md} style={styles.statSkeleton} />
          <Skeleton height={78} radius={themeRadius.md} style={styles.statSkeleton} />
          <Skeleton height={78} radius={themeRadius.md} style={styles.statSkeleton} />
        </View>

        <View style={styles.section}>
          <Skeleton height={13} width={120} radius={4} />
          <Card>
            <GuestRowSkeleton />
            <GuestRowSkeleton />
            <GuestRowSkeleton />
          </Card>
        </View>
      </Screen>
    );
  }

  if (event === undefined) {
    return (
      <Screen>
        <Header title={t('event.notFound')} showBack />
      </Screen>
    );
  }

  const counts = countRsvps(event.guests);
  const type = getEventType(event.type);
  const pendingUnsentCount = event.guests.filter(
    (guest) => guest.status === 'pending' && guest.whatsappSentAt === null && guest.phone !== null,
  ).length;

  return (
    <Screen>
      <Header title={`${type.emoji} ${event.name}`} subtitle={eventSubtitle(event)} showBack />

      <View style={styles.stats}>
        <StatCard
          label={t('common.confirmed')}
          value={counts.confirmed}
          tint={tokens.statusConfirmed}
          background={tokens.statusConfirmedSoft}
        />
        <StatCard
          label={t('common.pending')}
          value={counts.pending}
          tint={tokens.statusPending}
          background={tokens.statusPendingSoft}
        />
        <StatCard
          label={t('common.declined')}
          value={counts.declined}
          tint={tokens.statusDeclined}
          background={tokens.statusDeclinedSoft}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}>
            {t('event.guestListTitle', { count: counts.total })}
          </Text>
          {owner ? (
            <View style={styles.sectionHeadActions}>
              <TouchableOpacity
                style={[styles.add, { backgroundColor: `${tokens.accentPrimary}22` }]}
                onPress={() => router.push(`/add-guest/${event.id}`)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Invite a guest"
              >
                <Feather name="user-plus" size={16} color={tokens.accentPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.add, { backgroundColor: `${tokens.accentPrimary}22` }]}
                onPress={() => router.push(`/bulk-add-guests/${event.id}`)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('event.addMultipleGuests')}
              >
                <Feather name="users" size={16} color={tokens.accentPrimary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {owner && pendingUnsentCount > 0 ? (
          <TouchableOpacity
            style={[styles.sendPending, { borderColor: tokens.accentPrimary }]}
            onPress={() => router.push(`/send-invites/${event.id}`)}
            activeOpacity={0.75}
            accessibilityRole="button"
          >
            <Feather name="send" size={14} color={tokens.accentPrimary} />
            <Text style={[styles.sendPendingText, { color: tokens.accentPrimary }]}>
              {t('event.sendPendingInvites', { count: pendingUnsentCount })}
            </Text>
          </TouchableOpacity>
        ) : null}

        {event.guests.length === 0 ? (
          <EmptyState
            message={t('event.noGuestsYet')}
            action={
              owner ? (
                <Button
                  label={t('event.inviteGuest')}
                  onPress={() => router.push(`/add-guest/${event.id}`)}
                />
              ) : undefined
            }
          />
        ) : (
          <Card>
            {event.guests.map((guest) => (
              <SwipeableRow
                key={guest.id}
                enabled={owner}
                actions={[
                  {
                    label: t('event.removeGuestAction'),
                    icon: 'user-x',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        t('event.removeGuestTitle'),
                        t('event.removeGuestBody', { name: guest.name }),
                        () => removeGuest(event.id, guest.id),
                      ),
                  },
                ]}
              >
                <GuestRow guest={guest} />
              </SwipeableRow>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerSkeleton: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  statSkeleton: {
    flex: 1,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHeadActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  add: {
    width: 34,
    height: 34,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendPending: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 40,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
  },
  sendPendingText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
