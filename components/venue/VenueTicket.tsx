import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { useTheme } from '@/hooks/useTheme';
import type { MyVenueBooking, VenueBooking } from '@/types/venue';
import { getEventType } from '@/utils/eventTypes';
import { formatSpontaneousWhen } from '@/utils/spontaneous';
import { bandGradientLocations, typography } from '@/utils/themeTokens';

/**
 * The customer's ticket for a venue night: shown at the door. The QR holds
 * only the booking code, which the venue also sees in its bookings list.
 */
export function VenueTicket({ venue, booking }: { venue: VenueBooking; booking: MyVenueBooking }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const type = getEventType('venue');
  const zone = venue.zones.find((z) => z.id === booking.zoneId);
  const code = booking.bookingCode ?? '—';

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }, tokens.surfaceElevatedShadow ?? undefined]}>
      <LinearGradient colors={type.band} locations={bandGradientLocations} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.head}>
        <Text style={[styles.eyebrow, { color: type.bandInk }]}>{t('venue.ticket.title').toUpperCase()}</Text>
        <Text style={[styles.title, { color: type.bandInk }]} numberOfLines={2}>
          {venue.name}
        </Text>
        <Text style={[styles.meta, { color: type.bandInk }]}>{formatSpontaneousWhen(venue.date, venue.startTime)}</Text>
      </LinearGradient>
      <View style={styles.body}>
        <View style={styles.qr}>
          <QRCode value={code} size={132} backgroundColor="#FFFFFF" color="#1E1A30" />
        </View>
        <Text style={[styles.code, { color: tokens.textPrimary }]} selectable>
          {code}
        </Text>
        <Text style={[styles.hint, { color: tokens.textSecondary }]}>
          {booking.checkedInAt !== null ? t('venue.ticket.checkedIn') : t('venue.ticket.showAtDoor')}
        </Text>
        <View style={[styles.divider, { backgroundColor: tokens.border }]} />
        <Detail icon="users" label={t('venue.ticket.people')} value={String(booking.partySize ?? '—')} />
        {zone !== undefined ? <Detail icon="map-pin" label={t('venue.ticket.zone')} value={zone.name} /> : null}
        {booking.bookingTime !== null && booking.bookingTime.length > 0 ? (
          <Detail icon="clock" label={t('venue.ticket.arrival')} value={booking.bookingTime} />
        ) : null}
        <Detail icon="tag" label={t('venue.ticket.entry')} value={venue.priceInfo ?? t('venue.book.freeEntry')} />
      </View>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: 'users' | 'map-pin' | 'clock' | 'tag'; label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.detail}>
      <Feather name={icon} size={16} color={tokens.textSecondary} />
      <Text style={[styles.detailLabel, { color: tokens.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: tokens.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: 1,
    overflow: 'hidden',
  },
  head: {
    padding: 18,
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    opacity: 0.9,
  },
  title: {
    ...typography.title2,
  },
  meta: {
    fontSize: 13,
    opacity: 0.92,
  },
  body: {
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  qr: {
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  code: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: 13,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginVertical: 6,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  detailLabel: {
    fontSize: 14,
    width: 80,
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
});
