import { useQuery } from '@tanstack/react-query';
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
import { fetchInvitePreview } from '@/data/eventsRepository';
import type { RsvpStatus } from '@/types/event';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { getEventTypeGradient } from '@/utils/eventTypes';
import { spacing } from '@/utils/theme';

export default function InviteScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getEvent, respondToInvite, hydrated, isOwner } = useEvents();
  const { tokens, mode } = useTheme();
  const [editing, setEditing] = useState(false);
  const event = getEvent(id);
  // A cold-open deep link (opened straight into this route, no session and no
  // screen underneath it) has nothing to go back to — showing a back button
  // there would do nothing, so it's hidden rather than shown-but-dead.
  const canGoBack = router.canGoBack();

  // Fallback for a not-yet-linked invitee (typically a phone invite whose
  // guest_user_id the auto-link trigger hasn't reached this device's events
  // cache with yet, or genuinely hasn't linked at all) — see
  // get_invite_preview() in supabase/migrations/20260818000002_guest_phone_invites.sql
  // and CLAUDE.md's "invite preview under RLS" note. Only attempted once the
  // normal events-list lookup above has already come up empty for a signed-in
  // session; the already-linked path above is completely unchanged.
  const needsPreview = event === undefined && hydrated && user !== null && id !== undefined;
  const previewQuery = useQuery({
    queryKey: ['invitePreview', id, user?.id ?? null],
    queryFn: () => fetchInvitePreview(id as string),
    enabled: needsPreview,
    staleTime: 30_000,
  });
  const preview = previewQuery.data ?? null;

  if (event === undefined) {
    if (needsPreview && previewQuery.isLoading) {
      return (
        <Screen>
          <Header title={t('rsvp.openingTitle')} showBack={canGoBack} />
        </Screen>
      );
    }

    if (preview !== null) {
      const responded = preview.rsvpStatus !== 'pending';
      const showChoices = !responded || editing;

      const respond = (status: Exclude<RsvpStatus, 'pending'>) => {
        respondToInvite(preview.eventId, status);
        setEditing(false);
      };

      return (
        <Screen
          gradient={getEventTypeGradient(preview.type, mode)}
          footer={
            showChoices ? (
              <>
                <Button
                  label={t('rsvp.confirmAttendance')}
                  variant="success"
                  onPress={() => respond('confirmed')}
                />
                <Button label={t('rsvp.cantMakeIt')} variant="neutral" onPress={() => respond('declined')} />
              </>
            ) : (
              <>
                {preview.rsvpStatus === 'confirmed' ? (
                  <Button
                    label={t('rsvp.openEventPage')}
                    onPress={() => router.push(`/guest/${preview.eventId}`)}
                  />
                ) : null}
                <Button label={t('rsvp.changeMyAnswer')} variant="ghost" onPress={() => setEditing(true)} />
              </>
            )
          }
          contentStyle={styles.content}
        >
          {canGoBack ? <BackButton style={styles.back} /> : null}

          <View style={styles.centerGroup}>
            <View style={styles.spacer} />
            <InviteCard event={preview} />

            {responded && !editing ? (
              <Card style={styles.confirmation}>
                <Text style={styles.confirmationEmoji}>
                  {preview.rsvpStatus === 'confirmed' ? '🎉' : '💌'}
                </Text>
                <Text style={[styles.confirmationTitle, { color: tokens.textPrimary }]}>
                  {preview.rsvpStatus === 'confirmed' ? t('rsvp.confirmedTitle') : t('rsvp.declinedTitle')}
                </Text>
                <Text style={[styles.confirmationBody, { color: tokens.textSecondary }]}>
                  {preview.rsvpStatus === 'confirmed'
                    ? t('rsvp.confirmedBody', { eventName: preview.name })
                    : t('rsvp.declinedBody', { eventName: preview.name })}
                </Text>
              </Card>
            ) : null}
          </View>
        </Screen>
      );
    }

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
      // Per-event-type gradient, light/dark aware — see
      // utils/eventTypes.ts's getEventTypeGradient/EVENT_TYPE_GRADIENTS,
      // the single centralized lookup both this background and InviteCard's
      // own header strip read from, so the two can't drift out of sync.
      gradient={getEventTypeGradient(event.type, mode)}
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
      {/* A direct child of the content container, not of centerGroup below
          — see the styles.content comment for why: it has to stay pinned to
          the screen's actual top-left corner regardless of how short
          content (the owner branch, no confirmation card) gets vertically
          centered. */}
      {canGoBack ? <BackButton style={styles.back} /> : null}

      <View style={styles.centerGroup}>
        <View style={styles.spacer} />
        <InviteCard event={event} />

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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // React Native's ScrollView always gives its own outer box flexGrow: 1
  // (a hardcoded RN default — see ScrollView.js's baseVertical style —
  // applied regardless of what Screen.tsx passes), so it fills all
  // available space between the top safe area and the footer on every
  // screen that uses one, not just this one. Screen's contentContainerStyle
  // (this object) doesn't inherit that stretch itself by default — it
  // hugs its own children's height and top-aligns within that larger box —
  // which is invisible on screens whose content is long enough to fill the
  // screen anyway, but reads as a stranded card floating near the top with
  // a dead gap above the footer on this screen's shortest branch (the
  // owner's "Go to your event" view: just one card, no confirmation panel).
  // The standard fix, and what these two lines do: opt this content
  // container itself into the same flexGrow: 1, then justifyContent:
  // 'center' places the actual content in the middle of that filled space
  // instead of stuck at its top edge. A no-op once content is tall enough
  // to fill the screen on its own (nothing left to center into).
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  back: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 2,
  },
  centerGroup: {
    gap: spacing.lg,
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
