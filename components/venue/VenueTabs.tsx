import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Skeleton } from '@/components/Skeleton';
import { Eyebrow } from '@/components/spontaneous/parts';
import { VenueBookingPanel } from '@/components/venue/VenueBookingPanel';
import { VenueHomeCard } from '@/components/venue/VenueHomeCard';
import { VenueTicket } from '@/components/venue/VenueTicket';
import { useTheme } from '@/hooks/useTheme';
import { useVenue } from '@/hooks/useVenue';
import type { AppEvent } from '@/types/event';
import { formatSpontaneousWhen } from '@/utils/spontaneous';

/** Detalii on a venue night = "Book": the booking form, or the ticket with change/cancel. */
export function VenueBookTab({ event, owner }: { event: AppEvent; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { venue } = useVenue(event.id);
  return (
    <GuestScreen transparent>
      <View style={styles.head}>
        <Eyebrow>{t('venue.tabs.yourBooking')}</Eyebrow>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>
          {event.name} · {formatSpontaneousWhen(event.date, event.startTime)}
        </Text>
      </View>
      {owner ? <VenueHomeCard event={event} owner /> : null}
      {venue === null ? <Skeleton height={220} radius={22} /> : <VenueBookingPanel venue={venue} token={null} owner={owner} />}
    </GuestScreen>
  );
}

/** Fond on a venue night = "Ticket". */
export function VenueTicketTab({ event, owner }: { event: AppEvent; owner: boolean }) {
  const { t } = useTranslation();
  const { venue } = useVenue(event.id);
  const mine = venue?.myBooking?.status === 'confirmed' ? venue.myBooking : null;

  if (owner) {
    return (
      <GuestScreen transparent>
        <VenueHomeCard event={event} owner />
      </GuestScreen>
    );
  }
  return (
    <GuestScreen transparent>
      {venue === null ? (
        <Skeleton height={360} radius={26} />
      ) : mine !== null ? (
        <VenueTicket venue={venue} booking={mine} />
      ) : (
        <EmptyState
          message={`${t('venue.tabs.noTicket')}\n${t('venue.tabs.noTicketSub')}`}
          action={<Button label={t('venue.book.cta')} onPress={() => router.push(`/guest/${event.id}/detalii`)} />}
        />
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: 4,
  },
  sub: {
    fontSize: 13,
  },
});
