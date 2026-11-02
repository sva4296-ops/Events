import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { showDialog } from '@/components/ActionSheet';
import { AiWriteButton } from '@/components/AiWriteButton';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import type { Guest } from '@/types/event';
import { formatPhoneDisplay } from '@/utils/countryCodes';
import { haptics } from '@/utils/haptics';
import { reportSupabaseError } from '@/utils/reportError';
import { buildGuestInviteMessage, sendGuestSmsInvite, sendGuestWhatsAppInvite } from '@/utils/whatsappInvite';
import { themeRadius, whatsappFill } from '@/utils/themeTokens';

/**
 * "Send invites" queue — reached after a bulk save (app/bulk-add-guests/[id].tsx)
 * or directly from app/event/[id].tsx's "Send pending invites" button.
 * Pending queue = event.guests where status is 'pending', whatsappSentAt is
 * still null, and there's a phone to message (an email-only pending guest
 * has nothing for this screen to do). Derived client-side from the same
 * events cache useEvents() already holds — no separate fetch.
 *
 * "Sent" only ever means the app confirmed opening the wa.me link
 * (sendGuestWhatsAppInvite's return value) — a guest who was actually
 * shared via the fallback share sheet is *not* marked sent here, since
 * there's no way to confirm WhatsApp itself ever opened for them; Skip
 * exists for exactly that gap, and for "I don't have WhatsApp for this
 * person." Skip is session-local only — it never writes to the database,
 * so a skipped guest is back in the queue next time this screen opens; until
 * then they wait in their own section, still sendable. WhatsApp and SMS can't
 * report whether a message really went out, so the organizer is asked on coming
 * back; only a yes takes the guest off this screen. Resending to someone already
 * marked lives on their row in the guest list.
 */
/** Resolves when the user is back from the app we opened (or after 3s if it never left this one). */
function waitForReturn(): Promise<void> {
  return new Promise((resolve) => {
    let left = false;
    const finish = () => {
      subscription.remove();
      clearTimeout(timer);
      resolve();
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') left = true;
      else if (left) finish();
    });
    const timer = setTimeout(() => {
      if (!left) finish();
    }, 3000);
  });
}

export default function SendInvitesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, markWhatsAppSent, updateEvent } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);

  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  // The organizer's own invitation line; saved on the event before the first send.
  const [intro, setIntro] = useState(event?.inviteIntro ?? '');
  // Captured once, on mount, via the lazy initializer below — the running
  // "X of Y" total shouldn't shrink as the queue itself shrinks.
  const [totalAtStart] = useState(
    () =>
      event?.guests.filter((guest) => guest.status === 'pending' && guest.whatsappSentAt === null && guest.phone !== null)
        .length ?? 0,
  );

  if (event === undefined || !isOwner(event)) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('addGuestForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const queue = event.guests.filter(
    (guest) =>
      guest.status === 'pending' &&
      guest.whatsappSentAt === null &&
      guest.phone !== null &&
      !skippedIds.has(guest.id),
  );

  const skipped = event.guests.filter(
    (guest) =>
      guest.status === 'pending' &&
      guest.whatsappSentAt === null &&
      guest.phone !== null &&
      skippedIds.has(guest.id),
  );
  // SMS counts as sent too (whatsapp_sent_at is the queue's "invite sent"
  // flag), so a guest invited by SMS leaves the queue like a WhatsApp one.
  const sendToGuest = async (guest: Guest, channel: 'whatsapp' | 'sms') => {
    if (guest.phone === null) return;
    setSendingId(guest.id);
    // A guest with no real name falls back to their own phone number as
    // `name` (see data/eventsRepository.ts's mapGuestRow) — that's fine for
    // list display, but "Bună 40790586600," is an awkward greeting, so treat
    // that specific fallback as "no name" for the message itself.
    const displayName = guest.name === guest.phone ? '' : guest.name;
    // Save an edited line first, so it's also used later (single invites, other devices).
    if (intro.trim() !== event.inviteIntro.trim()) {
      await updateEvent(event.id, { inviteIntro: intro }).catch(reportSupabaseError);
    }
    const input = { guestName: displayName, event: { ...event, inviteIntro: intro }, inviteToken: guest.inviteToken };
    const opened =
      channel === 'sms'
        ? await sendGuestSmsInvite(guest.phone, input)
        : await sendGuestWhatsAppInvite(guest.phone, input);
    if (opened) await waitForReturn();
    setSendingId(null);
    if (opened) {
      showDialog({
        title: t('sendInvitesQueue.confirmSentTitle'),
        message: t('sendInvitesQueue.confirmSentBody', { name: guest.name }),
        buttons: [
          { label: t('sendInvitesQueue.confirmSentNo'), style: 'cancel' },
          {
            label: t('sendInvitesQueue.confirmSentYes'),
            onPress: () => {
              void markWhatsAppSent(event.id, guest.id);
              haptics.success();
              setSentCount((count) => count + 1);
            },
          },
        ],
      });
    }
  };

  const skipGuest = (guestId: string) => {
    setSkippedIds((current) => new Set(current).add(guestId));
  };

  const unskipGuest = (guestId: string) => {
    setSkippedIds((current) => {
      const next = new Set(current);
      next.delete(guestId);
      return next;
    });
  };

  const renderGuests = (guests: Guest[], section: 'queue' | 'skipped') => (
    <View style={[styles.list, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      {guests.map((guest, index) => (
        <View key={guest.id} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
          <View style={[styles.avatar, { backgroundColor: tokens.statusPendingSoft }]}>
            <Text maxFontSizeMultiplier={1.2} style={[styles.avatarText, { color: tokens.statusPending }]}>
              {guest.name === guest.phone ? '#' : initialsOf(guest.name)}
            </Text>
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
              {guest.name}
            </Text>
            {guest.phone !== null && guest.name !== guest.phone ? (
              <Text style={[styles.phone, { color: tokens.textSecondary }]} numberOfLines={1}>
                {formatPhoneDisplay(guest.phone)}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={() => (section === 'queue' ? skipGuest(guest.id) : unskipGuest(guest.id))}
            activeOpacity={0.7}
            accessibilityRole="button"
            style={styles.skipButton}
          >
            <Text style={[styles.skipButtonText, { color: tokens.textSecondary }]}>
              {t(section === 'queue' ? 'sendInvitesQueue.skipButton' : 'sendInvitesQueue.unskipButton')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smsButton, { borderColor: tokens.border }]}
            onPress={() => void sendToGuest(guest, 'sms')}
            disabled={sendingId === guest.id}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('sendInvitesQueue.smsButton')}
          >
            <Feather name="smartphone" size={17} color={tokens.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: whatsappFill }]}
            onPress={() => void sendToGuest(guest, 'whatsapp')}
            disabled={sendingId === guest.id}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('sendInvitesQueue.sendButton')}
          >
            <Feather name="message-circle" size={16} color="#FFFFFF" />
            <Text style={styles.sendButtonText}>
              {sendingId === guest.id ? t('sendInvitesQueue.sending') : t('sendInvitesQueue.sendButton')}
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const sample = queue[0] ?? skipped[0];
  const sampleMessage =
    sample !== undefined
      ? buildGuestInviteMessage({
          guestName: sample.name === sample.phone ? '' : sample.name,
          event: { ...event, inviteIntro: intro },
          inviteToken: sample.inviteToken,
        })
      : null;

  return (
    <Screen coverTheme={event?.coverTheme} contentStyle={styles.content}>
      <Header
        title=""
        showBack
        flowTitle={t('sendInvitesQueue.title')}
        stepLabel={t('sendInvitesQueue.flowSubtitle')}
      />

      {sampleMessage !== null ? (
        <Field
          label={t('sendInvitesQueue.introLabel')}
          value={intro}
          onChangeText={setIntro}
          placeholder={t('sendInvitesQueue.introPlaceholder')}
          hint={t('sendInvitesQueue.introHint')}
          multiline
          maxLength={400}
          action={
            <AiWriteButton
              eventId={id}
              kind="invite"
              value={intro}
              onChange={setIntro}
              maxChars={220}
              context={{ type: event.type, name: event.name, date: event.date, location: event.location }}
            />
          }
        />
      ) : null}

      {sampleMessage !== null ? (
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('sendInvitesQueue.messageLabel')}</Text>
          <View style={[styles.bubble, { backgroundColor: tokens.statusConfirmedSoft }]}>
            <Text style={[styles.bubbleText, { color: tokens.textPrimary }]}>{sampleMessage}</Text>
          </View>
          <Text style={[styles.hint, { color: tokens.textSecondary }]}>{t('sendInvitesQueue.messageHint')}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('sendInvitesQueue.recipients')}</Text>
        {totalAtStart > 0 ? (
          <Text style={[styles.progress, { color: tokens.textSecondary }]}>
            {t('sendInvitesQueue.progress', { sent: sentCount, total: totalAtStart })}
          </Text>
        ) : null}
      </View>

      {queue.length === 0 && skipped.length === 0 ? (
        <EmptyState
          message={t('sendInvitesQueue.empty')}
          action={<Button label={t('common.done')} variant="tonal" onPress={() => router.back()} />}
        />
      ) : null}
      {queue.length > 0 ? renderGuests(queue, 'queue') : null}

      {skipped.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('sendInvitesQueue.skippedTitle')}</Text>
          {renderGuests(skipped, 'skipped')}
        </>
      ) : null}

      <View style={[styles.note, { backgroundColor: tokens.accentTint }]}>
        <Feather name="info" size={18} color={tokens.accentText} />
        <Text style={[styles.noteText, { color: tokens.accentText }]}>{t('sendInvitesQueue.howItWorks')}</Text>
      </View>
    </Screen>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  bubble: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    fontSize: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  list: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
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
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  phone: {
    fontSize: 13,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: themeRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  smsButton: {
    width: 40,
    height: 40,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  skipButton: {
    minHeight: 40,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 16,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
});
