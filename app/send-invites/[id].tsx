import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import type { Guest } from '@/types/event';
import { sendGuestWhatsAppInvite } from '@/utils/whatsappInvite';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

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
    const opened = await sendGuestWhatsAppInvite(guest.phone, displayName);
    setSendingId(null);
    if (opened) {
      await markWhatsAppSent(event.id, guest.id);
      setSentCount((count) => count + 1);
    }
  };

  const skipGuest = (guestId: string) => {
    setSkippedIds((current) => new Set(current).add(guestId));
  };

  return (
    <Screen>
      <Header title={t('sendInvitesQueue.title')} subtitle={t('sendInvitesQueue.subtitle')} showBack />

      {totalAtStart > 0 ? (
        <Text style={[styles.progress, { color: tokens.textSecondary }]}>
          {t('sendInvitesQueue.progress', { sent: sentCount, total: totalAtStart })}
        </Text>
      ) : null}

      {queue.length === 0 ? (
        <EmptyState
          message={t('sendInvitesQueue.empty')}
          action={
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} accessibilityRole="button">
              <Text style={[styles.doneLink, { color: tokens.accentPrimary }]}>{t('common.done')}</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <Card>
          {queue.map((guest) => (
            <View
              key={guest.id}
              style={[styles.row, { borderBottomColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)' }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
                  {guest.name}
                </Text>
                {guest.phone !== null && guest.name !== guest.phone ? (
                  <Text style={[styles.phone, { color: tokens.textSecondary }]} numberOfLines={1}>
                    {guest.phone}
                  </Text>
                ) : null}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.sendButton, { backgroundColor: tokens.accentPrimary }]}
                  onPress={() => void sendToGuest(guest)}
                  disabled={sendingId === guest.id}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={styles.sendButtonText}>
                    {sendingId === guest.id
                      ? t('sendInvitesQueue.sending')
                      : t('sendInvitesQueue.sendButton')}
                  </Text>
                </TouchableOpacity>
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
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    fontSize: 13,
    fontWeight: '600',
  },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  rowText: {
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  phone: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sendButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  sendButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  skipButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  doneLink: {
    fontSize: 15,
    fontWeight: '700',
  },
});
