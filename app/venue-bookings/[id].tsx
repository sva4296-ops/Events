import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Bar } from '@/components/spontaneous/parts';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { useVenue } from '@/hooks/useVenue';
import { haptics } from '@/utils/haptics';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * Venue owner: occupancy per zone and every booking, with check-in at the
 * door (search by name or ticket code). Bookings are the event's
 * event_guests rows, already in the organizer's events cache.
 */
export default function VenueBookingsScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { venue, setCheckedIn } = useVenue(id ?? '');
  const [query, setQuery] = useState('');

  if (event === undefined || event.type !== 'venue' || !isOwner(event)) {
    return (
      <Screen>
        <Header title={t('common.notAvailable')} showBack />
      </Screen>
    );
  }

  const zones = venue?.zones ?? [];
  const zoneName = new Map(zones.map((zone) => [zone.id, zone.name]));
  const bookings = event.guests.filter((guest) => guest.status === 'confirmed' && guest.partySize !== null);
  const people = bookings.reduce((sum, guest) => sum + (guest.partySize ?? 0), 0);
  const capacity = zones.reduce((sum, zone) => sum + zone.capacity, 0);
  const inside = bookings.filter((guest) => guest.checkedInAt !== null).reduce((sum, guest) => sum + (guest.partySize ?? 0), 0);
  const needle = query.trim().toLowerCase();
  const visible = bookings
    .filter(
      (guest) =>
        needle.length === 0 ||
        guest.name.toLowerCase().includes(needle) ||
        (guest.bookingCode ?? '').toLowerCase().includes(needle),
    )
    .sort((a, b) => (a.bookingTime ?? '').localeCompare(b.bookingTime ?? '') || a.name.localeCompare(b.name));

  const card = [styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }];

  return (
    <Screen coverTheme={event.coverTheme} contentStyle={styles.content}>
      <Header
        title={t('venue.bookings.title')}
        subtitle={event.name}
        showBack
        right={
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            onPress={() => router.push(`/venue-setup/${event.id}`)}
            accessibilityRole="button"
            accessibilityLabel={t('venue.bookings.editSetup')}
          >
            <Feather name="sliders" size={19} color={tokens.textPrimary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.stats}>
        <Stat value={String(bookings.length)} label={t('venue.bookings.statBookings')} />
        <Stat value={capacity > 0 ? `${people}/${capacity}` : String(people)} label={t('venue.bookings.statPeople')} />
        <Stat value={String(inside)} label={t('venue.bookings.statInside')} />
      </View>

      <View style={card}>
        <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>{t('venue.bookings.byZone')}</Text>
        {zones.map((zone) => (
          <View key={zone.id} style={styles.zone}>
            <View style={styles.zoneHead}>
              <Text style={[styles.zoneName, { color: tokens.textPrimary }]}>{zone.name}</Text>
              <Text style={[styles.zoneCount, { color: tokens.textSecondary }]}>
                {zone.booked} / {zone.capacity}
              </Text>
            </View>
            <Bar ratio={zone.booked / zone.capacity} />
          </View>
        ))}
      </View>

      <Button
        label={t('venue.bookings.send')}
        variant="whatsapp"
        icon={<Feather name="message-circle" size={18} color={buttonLabelColor('whatsapp', tokens)} />}
        onPress={() => router.push(`/venue-send/${event.id}`)}
      />

      <View style={card}>
        <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>{t('venue.bookings.list')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('venue.bookings.search')}
          placeholderTextColor={tokens.textMuted}
          autoCapitalize="characters"
          style={[styles.search, { borderColor: tokens.border, color: tokens.textPrimary, backgroundColor: tokens.surface2 }]}
        />
        {visible.length === 0 ? (
          <Text style={[styles.empty, { color: tokens.textSecondary }]}>
            {bookings.length === 0 ? t('venue.bookings.empty') : t('venue.bookings.noMatch')}
          </Text>
        ) : null}
        {visible.map((guest, index) => {
          const inNow = guest.checkedInAt !== null;
          return (
            <View key={guest.id} style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: tokens.border }]}>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: tokens.textPrimary }]} numberOfLines={1}>
                  {guest.name}
                </Text>
                <Text style={[styles.rowSub, { color: tokens.textSecondary }]} numberOfLines={1}>
                  {[
                    t('venue.book.people', { count: guest.partySize ?? 0 }),
                    guest.zoneId !== null ? zoneName.get(guest.zoneId) : null,
                    guest.bookingTime,
                    guest.bookingCode,
                  ]
                    .filter((part): part is string => part !== null && part !== undefined && part.length > 0)
                    .join(' · ')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  haptics.tap();
                  setCheckedIn({ guestId: guest.id, checkedIn: !inNow });
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: inNow }}
                style={[
                  styles.checkin,
                  inNow
                    ? { backgroundColor: tokens.statusConfirmedSoft, borderColor: tokens.statusConfirmedSoft }
                    : { borderColor: tokens.accentPrimary },
                ]}
              >
                <Feather name={inNow ? 'check' : 'log-in'} size={14} color={inNow ? tokens.statusConfirmed : tokens.accentText} />
                <Text style={[styles.checkinText, { color: inNow ? tokens.statusConfirmed : tokens.accentText }]}>
                  {inNow ? t('venue.bookings.inside') : t('venue.bookings.checkIn')}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: tokens.accentTint }]}>
      <Text style={[styles.statValue, { color: tokens.accentText }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: tokens.accentText }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  zone: {
    gap: 6,
  },
  zoneHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  zoneName: {
    fontSize: 14,
    fontWeight: '600',
  },
  zoneCount: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  search: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 12.5,
  },
  checkin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
  },
  checkinText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
