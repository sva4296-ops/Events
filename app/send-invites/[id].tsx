import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import type { Guest } from '@/types/event';
import { formatPhoneDisplay } from '@/utils/countryCodes';
import { buildGuestInviteMessage, sendGuestWhatsAppInvite } from '@/utils/whatsappInvite';
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
 * so a skipped guest is back in the queue next time this screen opens.
 */
export default function SendInvitesScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, markWhatsAppSent } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);

  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
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

  const sendToGuest = async (guest: Guest) => {
    if (guest.phone === null) return;
    setSendingId(guest.id);
    // A guest with no real name falls back to their own phone number as
    // `name` (see data/eventsRepository.ts's mapGuestRow) — that's fine for
    // list display, but "Bună 40790586600," is an awkward greeting, so treat
    // that specific fallback as "no name" for the message itself.
    const displayName = guest.name === guest.phone ? '' : guest.name;
    const opened = await sendGuestWhatsAppInvite(guest.phone, {
      guestName: displayName,
      event,
      inviteToken: guest.inviteToken,
    });
    setSendingId(null);
    if (opened) {
      await markWhatsAppSent(event.id, guest.id);
      setSentCount((count) => count + 1);
    }
  };

  const skipGuest = (guestId: string) => {
    setSkippedIds((current) => new Set(current).add(guestId));
  };

  const sample = queue[0];
  const sampleMessage =
    sample !== undefined
      ? buildGuestInviteMessage({
          guestName: sample.name === sample.phone ? '' : sample.name,
          event,
          inviteToken: sample.inviteToken,
        })
      : null;

  return (
    <Screen contentStyle={styles.content}>
      <Header
        title=""
        showBack
        flowTitle={t('sendInvitesQueue.title')}
        stepLabel={t('sendInvitesQueue.flowSubtitle')}
      />

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

      {queue.length === 0 ? (
        <EmptyState
          message={t('sendInvitesQueue.empty')}
          action={<Button label={t('common.done')} variant="tonal" onPress={() => router.back()} />}
        />
      ) : (
        <View style={[styles.list, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          {queue.map((guest, index) => (
            <View
              key={guest.id}
              style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: tokens.statusPendingSoft }]}>
                <Text style={[styles.avatarText, { color: tokens.statusPending }]}>
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
                onPress={() => skipGuest(guest.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                style={styles.skipButton}
              >
                <Text style={[styles.skipButtonText, { color: tokens.textSecondary }]}>
                  {t('sendInvitesQueue.skipButton')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendButton, { backgroundColor: whatsappFill }]}
                onPress={() => void sendToGuest(guest)}
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
      )}

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
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
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
    height: 40,
    borderRadius: themeRadius.pill,
    paddingHorizontal: 14,
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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
