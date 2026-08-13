import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { InviteCard } from '@/components/InviteCard';
import { Screen } from '@/components/Screen';
import type { RsvpStatus } from '@/types/event';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { getEventType } from '@/utils/eventTypes';
import { spacing } from '@/utils/theme';

export default function InviteScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, respondToInvite, hydrated, isOwner } = useEvents();
  const { tokens, mode } = useTheme();
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
          title={hydrated ? t('rsvp.notFoundTitle') : t('rsvp.openingTitle')}
          showBack={canGoBack}
        />
        {hydrated ? (
          <Text style={[styles.note, { color: tokens.textSecondary }]}>{t('rsvp.notFoundNote')}</Text>
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
      // The per-event-type gradient stays as the light-mode background — see
      // utils/eventTypes.ts — but it's a fixed light palette with no dark
      // counterpart, so it can't also stand in for dark mode without
      // clashing with every other themed screen. Dark mode falls back to
      // Screen's own default (tokens.background), the same token the tab
      // bar/Live card/skeleton fixes already standardized on.
      gradient={mode === 'dark' ? tokens.background : type.gradient}
      footer={
        showChoices ? (
          owner ? (
            <Button label={t('rsvp.goToYourEvent')} onPress={() => router.push(`/guest/${event.id}`)} />
          ) : (
            <>
              <Button
                label={t('rsvp.confirmAttendance')}
                variant="success"
                onPress={() => respond('confirmed')}
              />
              <Button label={t('rsvp.cantMakeIt')} variant="neutral" onPress={() => respond('declined')} />
            </>
          )
        ) : (
          <>
            {myRsvp?.status === 'confirmed' ? (
              <Button
                label={t('rsvp.openEventPage')}
                onPress={() => router.push(`/guest/${event.id}`)}
              />
            ) : null}
            <Button label={t('rsvp.changeMyAnswer')} variant="ghost" onPress={() => setEditing(true)} />
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
          <Text style={[styles.confirmationTitle, { color: tokens.textPrimary }]}>
            {myRsvp.status === 'confirmed' ? t('rsvp.confirmedTitle') : t('rsvp.declinedTitle')}
          </Text>
          <Text style={[styles.confirmationBody, { color: tokens.textSecondary }]}>
            {myRsvp.status === 'confirmed'
              ? t('rsvp.confirmedBody', { eventName: event.name })
              : t('rsvp.declinedBody', { eventName: event.name })}
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
  // BackButton is absolutely positioned (floats over the hero, doesn't push
  // InviteCard down — deliberate, see components/BackButton.tsx), so nothing
  // else in this View's normal flow reserves space for it. It's a 40px
  // control starting at `spacing.md` from the top, so it extends to
  // spacing.md + 40; this spacer has to clear that or the card underneath
  // renders right under/behind it. spacing.xxl * 2 (64) clears it with room
  // to spare, reusing the existing scale rather than a one-off constant.
  spacer: {
    height: spacing.xxl * 2,
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
  },
  confirmationBody: {
    fontSize: 14,
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
  },
});
