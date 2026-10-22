import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { BackButton } from '@/components/BackButton';
import { BrandMark } from '@/components/BrandMark';
import { Button, buttonLabelColor } from '@/components/Button';
import { Header } from '@/components/Header';
import { InviteCard } from '@/components/InviteCard';
import { InviteReveal } from '@/components/InviteReveal';
import { Screen } from '@/components/Screen';
import { Toggle } from '@/components/Toggle';
import { fetchInvitePreview } from '@/data/eventsRepository';
import type { RsvpStatus } from '@/types/event';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useSpontaneous } from '@/hooks/useSpontaneous';
import { useTheme } from '@/hooks/useTheme';
import { formatEventDate } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { canOpenEventPage, spotsTaken } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { typography } from '@/utils/themeTokens';

/** Top row: back (when there is somewhere to go) + the wordmark. */
function InviteTopBar({ canGoBack }: { canGoBack: boolean }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.topBar}>
      {canGoBack ? <BackButton /> : null}
      <BrandMark width={40} />
      <Text style={[styles.brand, { color: tokens.textPrimary }]}>PovesteaNoastra</Text>
    </View>
  );
}

/** Warm Story 2.0 "Poți ajunge?" card with Confirm / Can't make it. */
function RsvpChoices({ onRespond }: { onRespond: (status: Exclude<RsvpStatus, 'pending'>) => void }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View style={[styles.panel, { backgroundColor: tokens.surface, borderColor: tokens.border }, tokens.surfaceElevatedShadow ?? undefined]}>
      <Text style={[styles.panelTitle, { color: tokens.textPrimary }]}>{t('rsvp.question')}</Text>
      <Button
        label={t('rsvp.confirmAttendance')}
        icon={<Feather name="check" size={20} color={buttonLabelColor('primary', tokens)} />}
        onPress={() => onRespond('confirmed')}
      />
      <Button label={t('rsvp.cantMakeIt')} variant="secondary" onPress={() => onRespond('declined')} />
    </View>
  );
}

/**
 * Spontaneous events: I'm in / Maybe / Can't, a +1 switch, spots taken and
 * the reply-by date. The +1 travels with the answer (guard_spot_limit counts it).
 */
function SpontaneousChoices({
  eventId,
  spotLimit,
  replyBy,
  initialPlusOne,
  alreadyConfirmed,
  onRespond,
}: {
  eventId: string;
  spotLimit: number | null;
  replyBy: string | null;
  initialPlusOne: boolean;
  alreadyConfirmed: boolean;
  onRespond: (status: Exclude<RsvpStatus, 'pending'>, plusOne: boolean) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { content } = useSpontaneous(eventId);
  const [plusOne, setPlusOne] = useState(initialPlusOne);
  const attendees = (content?.attendees ?? []).filter((attendee) => !attendee.isMe);
  const going = attendees.filter((attendee) => attendee.status === 'confirmed').length;
  const taken = spotsTaken(attendees);
  const full = spotLimit !== null && !alreadyConfirmed && taken + 1 + (plusOne ? 1 : 0) > spotLimit;
  const footer = [
    replyBy !== null ? t('spontaneous.rsvp.replyBy', { date: formatEventDate(replyBy) }) : null,
    going > 0 ? t('spontaneous.rsvp.alreadyYes', { count: going }) : null,
  ].filter((line): line is string => line !== null);

  return (
    <View style={[styles.panel, { backgroundColor: tokens.surface, borderColor: tokens.border }, tokens.surfaceElevatedShadow ?? undefined]}>
      <Text style={[styles.panelTitle, { color: tokens.textPrimary }]}>{t('spontaneous.rsvp.question')}</Text>
      {spotLimit !== null ? (
        <View style={styles.spots}>
          <View style={styles.spotsRow}>
            <Text style={[styles.spotsLabel, { color: tokens.textSecondary }]}>{t('spontaneous.rsvp.spotsTaken')}</Text>
            <Text style={[styles.spotsValue, { color: tokens.textPrimary }]}>
              {Math.min(taken, spotLimit)} / {spotLimit}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: tokens.surface2 }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: tokens.accentFill, width: `${Math.min(100, Math.round((taken / spotLimit) * 100))}%` },
              ]}
            />
          </View>
        </View>
      ) : null}
      <Button
        label={t('spontaneous.rsvp.yes')}
        disabled={full}
        icon={<Feather name="check" size={20} color={buttonLabelColor(full ? 'secondary' : 'primary', tokens)} />}
        onPress={() => onRespond('confirmed', plusOne)}
      />
      <View style={styles.choiceRow}>
        <Button
          label={t('spontaneous.rsvp.maybe')}
          variant="secondary"
          onPress={() => onRespond('maybe', plusOne)}
          style={styles.choiceButton}
        />
        <Button
          label={t('spontaneous.rsvp.no')}
          variant="secondary"
          onPress={() => onRespond('declined', false)}
          style={styles.choiceButton}
        />
      </View>
      <Toggle label={t('spontaneous.rsvp.plusOne')} value={plusOne} onChange={setPlusOne} />
      {full ? <Text style={[styles.note, styles.center, { color: tokens.statusDeclined }]}>{t('spontaneous.rsvp.full')}</Text> : null}
      {footer.length > 0 ? (
        <Text style={[styles.footnote, { color: tokens.textSecondary }]}>{footer.join(' · ')}</Text>
      ) : null}
    </View>
  );
}

/** Tinted result card once the guest has answered. */
function RsvpResult({ status, eventName }: { status: Exclude<RsvpStatus, 'pending'>; eventName: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const confirmed = status === 'confirmed';
  if (status === 'maybe') {
    return (
      <View style={[styles.result, { backgroundColor: tokens.accentTint }]}>
        <Text style={[styles.resultTitle, { color: tokens.accentText }]}>{t('spontaneous.rsvp.maybeTitle')}</Text>
        <Text style={[styles.resultBody, { color: tokens.textPrimary }]}>{t('spontaneous.rsvp.maybeBody', { eventName })}</Text>
      </View>
    );
  }
  const fg = confirmed ? tokens.statusConfirmed : tokens.statusDeclined;
  return (
    <View style={[styles.result, { backgroundColor: confirmed ? tokens.statusConfirmedSoft : tokens.statusDeclinedSoft }]}>
      {confirmed ? (
        <Animated.View
          entering={ZoomIn.springify().damping(12)}
          style={[styles.resultIcon, { backgroundColor: tokens.statusConfirmed }]}
        >
          <Animated.View entering={ZoomIn.delay(140).springify().damping(10)}>
            <Feather name="check" size={26} color={tokens.onAccent} />
          </Animated.View>
        </Animated.View>
      ) : null}
      <Text style={[styles.resultTitle, { color: fg }]}>
        {confirmed ? t('rsvp.confirmedTitle') : t('rsvp.declinedTitle')}
      </Text>
      <Text style={[styles.resultBody, { color: tokens.textPrimary }]}>
        {confirmed ? t('rsvp.confirmedBody', { eventName }) : t('rsvp.declinedBody', { eventName })}
      </Text>
    </View>
  );
}

export default function InviteScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getEvent, respondToInvite, hydrated, isOwner } = useEvents();
  const { tokens } = useTheme();
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

      const respond = (status: Exclude<RsvpStatus, 'pending'>, plusOne?: boolean) => {
        respondToInvite(preview.eventId, status, preview.type === 'spontaneous' ? (plusOne ?? false) : undefined);
        if (status === 'confirmed') haptics.success();
        setEditing(false);
      };

      return (
        <Screen contentStyle={styles.content}>
          <InviteTopBar canGoBack={canGoBack} />
          <InviteReveal type={preview.type}>
            <InviteCard event={preview} />
          </InviteReveal>
          {showChoices ? (
            preview.type === 'spontaneous' ? (
              <SpontaneousChoices
                eventId={preview.eventId}
                spotLimit={null}
                replyBy={null}
                initialPlusOne={false}
                alreadyConfirmed={preview.rsvpStatus === 'confirmed'}
                onRespond={respond}
              />
            ) : (
              <RsvpChoices onRespond={respond} />
            )
          ) : preview.rsvpStatus !== 'pending' ? (
            <>
              <RsvpResult status={preview.rsvpStatus} eventName={preview.name} />
              {canOpenEventPage(preview.type, preview.rsvpStatus) ? (
                <Button label={t('rsvp.openEventPage')} onPress={() => router.push(`/guest/${preview.eventId}`)} />
              ) : null}
              <Button label={t('rsvp.changeMyAnswer')} variant="ghost" onPress={() => setEditing(true)} />
            </>
          ) : null}
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

  // The organizer reaches this same screen via "Preview as guest" — never a
  // real RSVP (RLS rejects an event_guests insert for the organizer's own id),
  // so the owner gets a note and a way back to their event instead of choices.
  const owner = isOwner(event);

  // RLS already limits a non-organizer's event.guests to just their own row,
  // so [0] is "my" row. A 'pending' row exists before any answer, so a row
  // alone doesn't mean "responded".
  const myRsvp = owner ? undefined : event.guests[0];
  const responded = myRsvp !== undefined && myRsvp.status !== 'pending';
  const showChoices = !responded || editing;

  const spontaneous = event.type === 'spontaneous';
  const respond = (status: Exclude<RsvpStatus, 'pending'>, plusOne?: boolean) => {
    if (owner) return;
    respondToInvite(event.id, status, spontaneous ? (plusOne ?? false) : undefined);
    if (status === 'confirmed') haptics.success();
    setEditing(false);
  };

  return (
    <Screen contentStyle={styles.content}>
      <InviteTopBar canGoBack={canGoBack} />
      <InviteReveal type={event.type}>
        <InviteCard event={event} />
      </InviteReveal>

      {owner ? (
        <>
          <Text style={[styles.note, styles.center, { color: tokens.textSecondary }]}>{t('rsvp.ownerPreview')}</Text>
          <Button label={t('rsvp.goToYourEvent')} onPress={() => router.push(`/guest/${event.id}`)} />
        </>
      ) : showChoices ? (
        spontaneous ? (
          <SpontaneousChoices
            eventId={event.id}
            spotLimit={event.spotLimit}
            replyBy={event.replyBy}
            initialPlusOne={myRsvp?.plusOne ?? false}
            alreadyConfirmed={myRsvp?.status === 'confirmed'}
            onRespond={respond}
          />
        ) : (
          <RsvpChoices onRespond={respond} />
        )
      ) : myRsvp !== undefined && myRsvp.status !== 'pending' ? (
        <>
          <RsvpResult status={myRsvp.status} eventName={event.name} />
          {spontaneous && myRsvp.status !== 'declined' ? (
            <View style={[styles.panel, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              <Toggle
                label={t('spontaneous.rsvp.plusOne')}
                value={myRsvp.plusOne}
                onChange={(next) => respondToInvite(event.id, myRsvp.status as Exclude<RsvpStatus, 'pending'>, next)}
              />
            </View>
          ) : null}
          {canOpenEventPage(event.type, myRsvp.status) ? (
            <Button label={t('rsvp.openEventPage')} onPress={() => router.push(`/guest/${event.id}`)} />
          ) : null}
          <Button label={t('rsvp.changeMyAnswer')} variant="ghost" onPress={() => setEditing(true)} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: spacing.lg,
  },
  brand: {
    fontFamily: typography.title2.fontFamily,
    fontSize: 17,
    flexShrink: 1,
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  result: {
    borderRadius: 20,
    padding: 18,
    gap: 4,
    alignItems: 'center',
  },
  resultIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  resultBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  note: {
    fontSize: 14,
  },
  spots: {
    gap: 6,
  },
  spotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spotsLabel: {
    fontSize: 13,
  },
  spotsValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  choiceButton: {
    flex: 1,
  },
  footnote: {
    fontSize: 12.5,
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
