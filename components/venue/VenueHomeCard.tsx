import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { Bar } from '@/components/spontaneous/parts';
import { useTheme } from '@/hooks/useTheme';
import { useVenue } from '@/hooks/useVenue';
import type { AppEvent } from '@/types/event';

/**
 * Top of Acasă on a venue event: the venue sees how full the night is and
 * gets to its bookings / sending; a customer sees their booking at a glance.
 */
export function VenueHomeCard({ event, owner }: { event: AppEvent; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { venue } = useVenue(event.id);
  const card = [styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }, tokens.surfaceElevatedShadow ?? undefined];

  if (owner) {
    const zones = venue?.zones ?? [];
    const capacity = zones.reduce((sum, zone) => sum + zone.capacity, 0);
    const booked = zones.reduce((sum, zone) => sum + zone.booked, 0);
    const bookings = event.guests.filter((guest) => guest.status === 'confirmed' && guest.partySize !== null).length;
    return (
      <View style={card}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('venue.home.bookingsTitle')}</Text>
          <Text style={[styles.meta, { color: tokens.textSecondary }]}>
            {capacity > 0 ? t('venue.home.occupancy', { booked, capacity }) : t('venue.home.bookingsCount', { count: bookings })}
          </Text>
        </View>
        {capacity > 0 ? <Bar ratio={booked / capacity} /> : null}
        <View style={styles.actions}>
          <Button label={t('venue.home.seeBookings')} variant="tonal" onPress={() => router.push(`/venue-bookings/${event.id}`)} style={styles.flex} />
          <Button
            label={t('venue.home.send')}
            variant="whatsapp"
            icon={<Feather name="message-circle" size={17} color={buttonLabelColor('whatsapp', tokens)} />}
            onPress={() => router.push(`/venue-send/${event.id}`)}
            style={styles.flex}
          />
        </View>
      </View>
    );
  }

  const mine = venue?.myBooking ?? null;
  const booked = mine !== null && mine.status === 'confirmed';
  const zone = venue?.zones.find((z) => z.id === mine?.zoneId);
  return (
    <View style={card}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>
          {booked ? t('venue.home.yourBooking') : t('venue.home.notBooked')}
        </Text>
        {booked && mine.bookingCode !== null ? (
          <Text style={[styles.code, { color: tokens.accentText }]}>{mine.bookingCode}</Text>
        ) : null}
      </View>
      {booked ? (
        <Text style={[styles.meta, { color: tokens.textSecondary }]}>
          {[t('venue.book.people', { count: mine.partySize ?? 0 }), zone?.name, mine.bookingTime]
            .filter((part): part is string => part !== undefined && part !== null && part.length > 0)
            .join(' · ')}
        </Text>
      ) : null}
      <Button
        label={booked ? t('venue.home.seeTicket') : t('venue.book.cta')}
        variant={booked ? 'tonal' : 'primary'}
        onPress={() => router.push(`/book/${event.id}`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  meta: {
    fontSize: 13.5,
  },
  code: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
});
