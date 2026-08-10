import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { GuestRow } from '@/components/GuestRow';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { StatCard } from '@/components/StatCard';
import { SwipeableRow } from '@/components/SwipeableRow';
import { confirmDelete } from '@/utils/confirm';
import { useEvents } from '@/hooks/useEvents';
import { countRsvps, eventSubtitle } from '@/utils/format';
import { getEventType } from '@/utils/eventTypes';
import { shareInvite } from '@/utils/invite';
import { colors, radius, spacing } from '@/utils/theme';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, removeGuest, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);

  if (event === undefined) {
    return (
      <Screen>
        <Header title="Event not found" showBack />
      </Screen>
    );
  }

  const counts = countRsvps(event.guests);
  const type = getEventType(event.type);

  return (
    <Screen
      footer={
        <>
          <Button label="Share invitation" onPress={() => void shareInvite(event)} />
          <Button
            label="Preview as guest"
            variant="secondary"
            onPress={() => router.push({ pathname: '/invite/[id]', params: { id: event.id } })}
          />
          {owner ? (
            <Button
              label="Edit event"
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
          label="Confirmed"
          value={counts.confirmed}
          tint={colors.success}
          background={colors.successSoft}
        />
        <StatCard
          label="Pending"
          value={counts.pending}
          tint={colors.warning}
          background={colors.warningSoft}
        />
        <StatCard
          label="Declined"
          value={counts.declined}
          tint={colors.danger}
          background={colors.dangerSoft}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Guest list · {counts.total}</Text>
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
            message="No guests invited yet."
            action={
              owner ? (
                <Button
                  label="Invite a guest"
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
                    label: 'Elimină',
                    icon: 'user-x',
                    tone: 'delete',
                    onPress: () =>
                      confirmDelete(
                        'Elimini invitatul?',
                        `${guest.name} nu va mai apărea în lista de invitați.`,
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
