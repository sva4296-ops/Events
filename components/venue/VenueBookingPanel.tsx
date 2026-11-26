import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Toggle } from '@/components/Toggle';
import { VenueTicket } from '@/components/venue/VenueTicket';
import { useTheme } from '@/hooks/useTheme';
import { useVenue } from '@/hooks/useVenue';
import type { VenueBooking } from '@/types/venue';
import { confirmDelete } from '@/utils/confirm';
import { haptics } from '@/utils/haptics';
import { themeRadius, typography } from '@/utils/themeTokens';

/**
 * The booking form for a venue night, or the ticket once booked (with change /
 * cancel). Used by the public booking page (app/book/[id].tsx) and the Book
 * tab of the night's page. `owner` shows a preview note instead of the form.
 */
export function VenueBookingPanel({ venue, token, owner }: { venue: VenueBooking; token: string | null; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { book, booking, cancel } = useVenue(venue.eventId, token);
  const mine = venue.myBooking !== null && venue.myBooking.status === 'confirmed' ? venue.myBooking : null;
  const [editing, setEditing] = useState(false);

  const firstOpenZone = venue.zones.find((zone) => zone.capacity - zone.booked > 0) ?? venue.zones[0];
  const [partySize, setPartySize] = useState(mine?.partySize ?? Math.min(2, venue.maxPartySize));
  const [zoneId, setZoneId] = useState<string | null>(mine?.zoneId ?? firstOpenZone?.id ?? null);
  const [time, setTime] = useState<string | null>(mine?.bookingTime ?? venue.bookingTimes[0] ?? null);
  const [follow, setFollow] = useState(false);

  const free = (zone: VenueBooking['zones'][number]) =>
    zone.capacity - zone.booked + (mine !== null && mine.zoneId === zone.id ? (mine.partySize ?? 0) : 0);
  const zone = venue.zones.find((z) => z.id === zoneId) ?? null;
  const fits = zone !== null && free(zone) >= partySize;
  const canBook = !owner && zone !== null && fits && (venue.bookingTimes.length === 0 || time !== null) && !booking;

  const submit = async () => {
    if (zone === null) return;
    try {
      await book({ partySize, zoneId: zone.id, time: time ?? '', follow: mine === null && follow && venue.agencyId !== null });
      haptics.success();
      setEditing(false);
    } catch {
      // useVenue already showed the reason.
    }
  };

  if (owner) {
    return <Text style={[styles.note, styles.center, { color: tokens.textSecondary }]}>{t('venue.book.ownerPreview')}</Text>;
  }

  if (mine !== null && !editing) {
    return (
      <View style={styles.wrap}>
        <VenueTicket venue={venue} booking={mine} />
        <View style={styles.row}>
          <Button label={t('venue.book.change')} variant="secondary" onPress={() => setEditing(true)} style={styles.flex} />
          <Button
            label={t('venue.book.cancel')}
            variant="secondary"
            onPress={() => confirmDelete(t('venue.book.cancelTitle'), t('venue.book.cancelBody'), () => cancel(mine.guestId))}
            style={styles.flex}
          />
        </View>
      </View>
    );
  }

  const card = [styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }];

  return (
    <View style={styles.wrap}>
      <View style={card}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('venue.book.howMany')}</Text>
        <View style={[styles.stepper, { backgroundColor: tokens.accentTint }]}>
          <StepButton icon="minus" disabled={partySize <= 1} onPress={() => setPartySize((n) => Math.max(1, n - 1))} />
          <Text style={[styles.stepValue, { color: tokens.textPrimary }]}>
            {partySize} <Text style={[styles.stepUnit, { color: tokens.textSecondary }]}>{t('venue.book.peopleShort')}</Text>
          </Text>
          <StepButton
            icon="plus"
            disabled={partySize >= venue.maxPartySize}
            onPress={() => setPartySize((n) => Math.min(venue.maxPartySize, n + 1))}
          />
        </View>
      </View>

      <View style={card}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('venue.book.where')}</Text>
        {venue.zones.map((z) => {
          const left = free(z);
          const selected = z.id === zoneId;
          return (
            <TouchableOpacity
              key={z.id}
              disabled={left <= 0}
              onPress={() => {
                haptics.tap();
                setZoneId(z.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled: left <= 0 }}
              style={[
                styles.zone,
                { borderColor: selected ? tokens.accentPrimary : tokens.border, borderWidth: selected ? 2 : 1 },
                left <= 0 && styles.disabled,
              ]}
            >
              <View style={styles.flex}>
                <Text style={[styles.zoneName, { color: tokens.textPrimary }]}>{z.name}</Text>
                {z.detail.length > 0 ? <Text style={[styles.zoneDetail, { color: tokens.textSecondary }]}>{z.detail}</Text> : null}
              </View>
              <View style={[styles.pill, { backgroundColor: left <= 0 ? tokens.statusDeclinedSoft : tokens.accentTint }]}>
                <Text style={[styles.pillText, { color: left <= 0 ? tokens.statusDeclined : tokens.accentText }]}>
                  {left <= 0 ? t('venue.book.full') : t('venue.book.free', { count: left })}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {zone !== null && !fits && free(zone) > 0 ? (
          <Text style={[styles.note, { color: tokens.statusDeclined }]}>{t('venue.book.tooMany', { count: free(zone) })}</Text>
        ) : null}
      </View>

      {venue.bookingTimes.length > 0 ? (
        <View style={card}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('venue.book.arrival')}</Text>
          <View style={styles.chips}>
            {venue.bookingTimes.map((slot) => {
              const on = slot === time;
              return (
                <TouchableOpacity
                  key={slot}
                  onPress={() => {
                    haptics.tap();
                    setTime(slot);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[
                    styles.chip,
                    on ? { backgroundColor: tokens.accentFill, borderColor: tokens.accentFill } : { borderColor: tokens.border },
                  ]}
                >
                  <Text style={[styles.chipText, { color: on ? tokens.onAccent : tokens.textPrimary }]}>{slot}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.accentPrimary }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryMeta, { color: tokens.textSecondary }]}>
            {[t('venue.book.people', { count: partySize }), zone?.name, time].filter((part): part is string => part != null && part.length > 0).join(' · ')}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: tokens.textPrimary }]}>{t('venue.book.entry')}</Text>
          <Text style={[styles.summaryValue, { color: tokens.accentText }]} numberOfLines={2}>
            {venue.priceInfo ?? t('venue.book.freeEntry')}
          </Text>
        </View>
        {mine === null && venue.agencyId !== null && !venue.following ? (
          <Toggle label={t('venue.book.optIn', { venue: venue.hostName ?? t('venue.book.thisVenue') })} value={follow} onChange={setFollow} />
        ) : null}
        <Button
          label={booking ? t('venue.book.booking') : mine !== null ? t('venue.book.saveChange') : t('venue.book.cta')}
          disabled={!canBook}
          onPress={() => void submit()}
        />
        {editing ? <Button label={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} /> : null}
        <Text style={[styles.note, styles.center, { color: tokens.textSecondary }]}>{t('venue.book.payAtVenue')}</Text>
      </View>
    </View>
  );
}

function StepButton({ icon, disabled, onPress }: { icon: 'plus' | 'minus'; disabled: boolean; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={icon}
      style={[styles.stepButton, { backgroundColor: tokens.surface }, tokens.surfaceElevatedShadow ?? undefined, disabled && styles.disabled]}
    >
      <Feather name={icon} size={20} color={tokens.accentText} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 6,
  },
  stepButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    ...typography.title2,
  },
  stepUnit: {
    fontSize: 14,
    fontWeight: '400',
  },
  zone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  zoneName: {
    fontSize: 15,
    fontWeight: '600',
  },
  zoneDetail: {
    fontSize: 12.5,
  },
  pill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 38,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryMeta: {
    fontSize: 13.5,
  },
  summaryLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  summaryValue: {
    ...typography.title2,
    flexShrink: 1,
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  note: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  center: {
    textAlign: 'center',
  },
});
