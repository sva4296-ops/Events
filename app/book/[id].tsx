import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { VenueBookingPanel } from '@/components/venue/VenueBookingPanel';
import { VenueLineup, VenuePlaceCard } from '@/components/venue/VenueTonight';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { useVenue } from '@/hooks/useVenue';
import type { VenueBooking } from '@/types/venue';
import { getEventType } from '@/utils/eventTypes';
import { formatSpontaneousWhen } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';
import { bandGradientLocations, themeRadius, typography } from '@/utils/themeTokens';

/**
 * A venue event's public booking page ("Local"). Reached from the venue's
 * public link (app/i/[token].tsx passes `t`), from Home's invitations and from
 * the invite screen. Once booked, the night's own page (/guest/<id>) has the
 * same form under its Book tab and the ticket under Ticket.
 */
export default function BookScreen() {
  const { t } = useTranslation();
  const { id, t: token } = useLocalSearchParams<{ id: string; t?: string }>();
  const { venue, loading, notFound } = useVenue(id ?? '', token ?? null);
  const canGoBack = router.canGoBack();

  if (venue === null) {
    return (
      <Screen>
        <Header title={loading || !notFound ? t('rsvp.openingTitle') : t('rsvp.notFoundTitle')} showBack={canGoBack} />
      </Screen>
    );
  }
  return <BookingPage venue={venue} token={token ?? null} canGoBack={canGoBack} />;
}

function BookingPage({ venue, token, canGoBack }: { venue: VenueBooking; token: string | null; canGoBack: boolean }) {
  const { t } = useTranslation();
  const { getEvent, isOwner } = useEvents();
  const { tokens } = useTheme();
  const type = getEventType('venue');
  const owner = isOwner(getEvent(venue.eventId));
  const booked = venue.myBooking?.status === 'confirmed';

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        booked && !owner ? (
          <Button label={t('venue.book.openNight')} onPress={() => router.push(`/guest/${venue.eventId}`)} />
        ) : undefined
      }
    >
      <View style={styles.top}>{canGoBack ? <BackButton /> : null}</View>

      <LinearGradient colors={type.band} locations={bandGradientLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cover}>
        {venue.hostName !== null ? (
          <Text style={[styles.coverEyebrow, { color: type.bandInk }]}>{t('venue.tonight.invites', { venue: venue.hostName }).toUpperCase()}</Text>
        ) : null}
        <Text style={[styles.coverTitle, { color: type.bandInk }]}>{venue.name}</Text>
        <Text style={[styles.coverMeta, { color: type.bandInk }]}>{formatSpontaneousWhen(venue.date, venue.startTime)}</Text>
        <View style={styles.coverChip}>
          <Text style={styles.coverChipText}>{venue.priceInfo ?? t('venue.book.freeEntry')}</Text>
        </View>
      </LinearGradient>

      {venue.welcomeMessage.trim().length > 0 ? (
        <Text style={[styles.desc, { color: tokens.textPrimary }]}>{venue.welcomeMessage}</Text>
      ) : null}

      <VenueBookingPanel venue={venue} token={token} owner={owner} />
      <VenueLineup venue={venue} />
      <VenuePlaceCard venue={venue} owner={owner} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  top: {
    flexDirection: 'row',
    paddingTop: spacing.lg,
    minHeight: spacing.lg + 40,
  },
  cover: {
    borderRadius: 26,
    padding: 22,
    gap: 4,
  },
  coverEyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    opacity: 0.9,
  },
  coverTitle: {
    ...typography.display,
    fontSize: 30,
    lineHeight: 36,
  },
  coverMeta: {
    fontSize: 14,
    opacity: 0.92,
  },
  coverChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: themeRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
  },
  coverChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2B2740',
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
  },
});
