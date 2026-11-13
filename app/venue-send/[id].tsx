import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/spontaneous/parts';
import { useAgency } from '@/hooks/useAgency';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { useVenueFollowers } from '@/hooks/useVenue';
import { formatPhoneDisplay } from '@/utils/countryCodes';
import { haptics } from '@/utils/haptics';
import { reportSupabaseError } from '@/utils/reportError';
import { spacing } from '@/utils/theme';
import { themeRadius, whatsappFill } from '@/utils/themeTokens';
import { buildVenueMessage, sendPhoneMessage } from '@/utils/whatsappInvite';

/**
 * Venue owner: send a venue night to customers. Two ways, same rule as the
 * prototype: the public link anywhere (status, story, the venue's group), and
 * direct WhatsApp messages only to customers who agreed (venue_followers).
 */
export default function VenueSendScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const { agency } = useAgency();
  const event = getEvent(id);
  const { followers, loading } = useVenueFollowers(event?.agency_id ?? agency?.id ?? null);
  const [sent, setSent] = useState<Set<string>>(() => new Set());

  if (event === undefined || event.type !== 'venue' || !isOwner(event)) {
    return (
      <Screen>
        <Header title={t('common.notAvailable')} showBack />
      </Screen>
    );
  }

  const publicMessage = buildVenueMessage(event, false);
  const directMessage = buildVenueMessage(event, true);
  const reachable = followers.filter((follower) => follower.phone !== null && follower.phone.length > 0);

  const shareLink = async () => {
    try {
      await Share.share({ message: publicMessage });
    } catch (error) {
      reportSupabaseError(error);
    }
  };

  return (
    <Screen coverTheme={event.coverTheme} contentStyle={styles.content}>
      <Header title={t('venue.send.title')} subtitle={t('venue.send.subtitle')} showBack />

      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>{t('venue.send.linkTitle')}</Text>
        <Text style={[styles.cardSub, { color: tokens.textSecondary }]}>{t('venue.send.linkSub')}</Text>
        <View style={[styles.bubble, { backgroundColor: tokens.surface2 }]}>
          <Text style={[styles.bubbleText, { color: tokens.textPrimary }]} selectable>
            {publicMessage}
          </Text>
        </View>
        <Button
          label={t('venue.send.share')}
          icon={<Feather name="share-2" size={18} color={buttonLabelColor('primary', tokens)} />}
          onPress={() => void shareLink()}
        />
      </View>

      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>{t('venue.send.customersTitle')}</Text>
        <Text style={[styles.cardSub, { color: tokens.textSecondary }]}>
          {loading ? t('rsvp.openingTitle') : t('venue.send.customersCount', { count: reachable.length })}
        </Text>
        {!loading && reachable.length === 0 ? (
          <Text style={[styles.cardSub, { color: tokens.textSecondary }]}>{t('venue.send.noCustomers')}</Text>
        ) : null}
        {reachable.map((follower, index) => {
          const done = sent.has(follower.userId);
          return (
            <View key={follower.userId} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
              <Avatar name={follower.name ?? '?'} index={index} size={36} />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: tokens.textPrimary }]} numberOfLines={1}>
                  {follower.name ?? (follower.phone !== null ? formatPhoneDisplay(follower.phone) : '—')}
                </Text>
                <Text style={[styles.rowSub, { color: tokens.textSecondary }]}>
                  {follower.source === 'booking' ? t('venue.send.sourceBooking') : t('venue.send.sourceFollow')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.press();
                  void sendPhoneMessage(follower.phone as string, directMessage, 'whatsapp');
                  setSent((current) => new Set(current).add(follower.userId));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('venue.send.sendTo', { name: follower.name ?? '' })}
                style={[styles.send, { backgroundColor: done ? tokens.surface2 : whatsappFill }]}
              >
                <Feather name={done ? 'check' : 'message-circle'} size={16} color={done ? tokens.textSecondary : '#FFFFFF'} />
                <Text style={[styles.sendText, { color: done ? tokens.textSecondary : '#FFFFFF' }]}>
                  {done ? t('venue.send.sent') : 'WhatsApp'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <Text style={[styles.rule, { color: tokens.textSecondary }]}>{t('venue.send.rule')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  bubble: {
    borderRadius: 16,
    padding: 14,
  },
  bubbleText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
  },
  send: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: themeRadius.pill,
  },
  sendText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rule: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
