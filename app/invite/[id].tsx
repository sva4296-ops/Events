import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { InviteCard } from '@/components/InviteCard';
import { Screen } from '@/components/Screen';
import type { RsvpStatus } from '@/types/event';
import { useEvents } from '@/hooks/useEvents';
import { getEventType } from '@/utils/eventTypes';
import { colors, spacing } from '@/utils/theme';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, respondToInvite, hydrated, isOwner } = useEvents();
  const [editing, setEditing] = useState(false);
  const event = getEvent(id);
  // A cold-open deep link (opened straight into this route, no session and no
  // screen underneath it) has nothing to go back to — showing a back button
  // there would do nothing, so it's hidden rather than shown-but-dead.
  const canGoBack = router.canGoBack();

  if (event === undefined) {
    return (
      <Screen>
        <Header
          title={hydrated ? 'Invitation not found' : 'Opening invitation…'}
          showBack={canGoBack}
        />
        {hydrated ? (
          <Text style={styles.note}>
            This invitation link is no longer available on this device.
          </Text>
        ) : null}
      </Screen>
    );
  }

  // The organizer reaches this same screen via "Preview as guest" (dashboard and
  // the create-event flow's share step) — never a real RSVP, and an event_guests
  // insert for the organizer's own id is rejected by RLS ("guest claims own
  // invite" requires not is_event_organizer). Keep the buttons visible so they can
  // see what guests see, but never let a tap reach respondToInvite.
  const owner = isOwner(event);

  // RLS already limits a non-organizer's event.guests to just their own row,
  // so [0] is "my" row.
  const myRsvp = owner ? undefined : event.guests[0];
  const type = getEventType(event.type);
  // A guest invited by email already has an `event_guests` row *before* they
  // ever respond — its rsvp_status is 'pending'. `myRsvp !== undefined` alone
  // only means "a row exists," not "they answered," so it can't gate the
  // confirmed/declined UI on its own — that previously showed the decline
  // copy (and an "Open event page" button) for a genuinely unanswered invite.
  const responded = myRsvp !== undefined && myRsvp.status !== 'pending';
  const showChoices = !responded || editing;

  const respond = (status: Exclude<RsvpStatus, 'pending'>) => {
    if (owner) return;
    respondToInvite(event.id, status);
    setEditing(false);
  };

  return (
    <Screen
      gradient={type.gradient}
      footer={
        showChoices ? (
          owner ? (
            <Button label="Go to your event" onPress={() => router.push(`/guest/${event.id}`)} />
          ) : (
            <>
              <Button
                label="Confirm attendance"
                variant="success"
                onPress={() => respond('confirmed')}
              />
              <Button label="Can't make it" variant="neutral" onPress={() => respond('declined')} />
            </>
          )
        ) : (
          <>
            {myRsvp?.status === 'confirmed' ? (
              <Button
                label="Deschide pagina evenimentului"
                onPress={() => router.push(`/guest/${event.id}`)}
              />
            ) : null}
            <Button label="Change my answer" variant="ghost" onPress={() => setEditing(true)} />
          </>
        )
      }
      contentStyle={styles.content}
    >
      <View>
        {canGoBack ? <BackButton style={styles.back} /> : null}
        <View style={styles.spacer} />
        <InviteCard event={event} />
      </View>

      {responded && !editing ? (
        <Card style={styles.confirmation}>
          <Text style={styles.confirmationEmoji}>
            {myRsvp.status === 'confirmed' ? '🎉' : '💌'}
          </Text>
          <Text style={styles.confirmationTitle}>
            {myRsvp.status === 'confirmed' ? "You're on the list!" : 'Thanks for letting us know'}
          </Text>
          <Text style={styles.confirmationBody}>
            {myRsvp.status === 'confirmed'
              ? `We can't wait to see you at ${event.name}.`
              : `You'll be missed at ${event.name}.`}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  back: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 2,
  },
  spacer: {
    height: spacing.lg,
  },
  confirmation: {
    alignItems: 'center',
  },
  confirmationEmoji: {
    fontSize: 32,
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  confirmationBody: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
    color: colors.muted,
  },
});
