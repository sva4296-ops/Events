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
import { countRsvps, eventSubtitle } from '@/utils/format';
import { getEventType } from '@/utils/eventTypes';
import { shareInvite } from '@/utils/invite';
import { colors, radius, spacing } from '@/utils/theme';

export default function EventDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, hydrated, removeGuest, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);

  // Before the initial fetch settles, `getEvent` can't tell "still loading"
  // from "no such event" — `hydrated` is what actually distinguishes them.
  if (!hydrated) {
    return (
      <Screen>
        <View style={styles.headerSkeleton}>
          <Skeleton width={40} height={40} radius={radius.pill} />
          <Skeleton height={28} width="70%" radius={6} />
          <Skeleton height={15} width="45%" radius={4} />
        </View>

        <View style={styles.stats}>
          <Skeleton height={78} radius={radius.md} style={styles.statSkeleton} />
          <Skeleton height={78} radius={radius.md} style={styles.statSkeleton} />
          <Skeleton height={78} radius={radius.md} style={styles.statSkeleton} />
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

  return (
    <Screen
      footer={
        <>
          <Button label={t('event.shareInvitation')} onPress={() => void shareInvite(event)} />
          <Button
            label={t('event.previewAsGuest')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/invite/[id]', params: { id: event.id } })}
          />
          {owner ? (
            <Button
              label={t('event.editEvent')}
              variant="ghost"
              onPress={() => router.push(`/edit-event/${event.id}`)}
            />
          ) : null}
        </>
      }
    >
      <Header
        title={`${type.emoji} ${event.name}`}
        subtitle={eventSubtitle(event)}
        showBack
      />

      <View style={styles.stats}>
        <StatCard
          label={t('common.confirmed')}
          value={counts.confirmed}
          tint={colors.success}
          background={colors.successSoft}
        />
        <StatCard
          label={t('common.pending')}
          value={counts.pending}
          tint={colors.warning}
          background={colors.warningSoft}
        />
        <StatCard
          label={t('common.declined')}
          value={counts.declined}
          tint={colors.declined}
          background={colors.declinedSoft}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{t('event.guestListTitle', { count: counts.total })}</Text>
          {owner ? (
            <TouchableOpacity
              style={styles.add}
              onPress={() => router.push(`/add-guest/${event.id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Invite a guest"
            >
              <Feather name="user-plus" size={16} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>

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
    color: colors.faint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  add: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
