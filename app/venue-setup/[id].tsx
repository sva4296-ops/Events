import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { VenueSetupForm, isVenueSetupValid, type VenueSetupValue } from '@/components/venue/VenueSetupForm';
import { useEvents } from '@/hooks/useEvents';
import { useVenue } from '@/hooks/useVenue';
import type { AppEvent } from '@/types/event';
import type { VenueBooking } from '@/types/venue';
import { parseSpotLimit } from '@/utils/spontaneous';
import { reportSupabaseError } from '@/utils/reportError';

/** Venue owner: edit zones, arrival slots, price line and max party size after creation. */
export default function VenueSetupScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { venue } = useVenue(id ?? '');

  if (event === undefined || event.type !== 'venue' || !isOwner(event)) {
    return (
      <Screen>
        <Header title={t('common.notAvailable')} showBack />
      </Screen>
    );
  }
  if (venue === null) {
    return (
      <Screen>
        <Header title={t('venue.wizard.setupTitle')} showBack />
      </Screen>
    );
  }
  return <SetupForm event={event} venue={venue} />;
}

function SetupForm({ event, venue }: { event: AppEvent; venue: VenueBooking }) {
  const { t } = useTranslation();
  const { updateEvent } = useEvents();
  const { saveZones } = useVenue(event.id);
  const [value, setValue] = useState<VenueSetupValue>({
    zones: venue.zones.map((zone) => ({
      key: zone.id,
      id: zone.id,
      name: zone.name,
      detail: zone.detail,
      capacity: String(zone.capacity),
    })),
    bookingTimes: venue.bookingTimes,
    priceInfo: venue.priceInfo ?? '',
    maxPartySize: String(venue.maxPartySize),
  });
  const [busy, setBusy] = useState(false);

  // A zone can't shrink below the people already booked in it.
  const tooSmall = value.zones.find((zone) => {
    const booked = venue.zones.find((z) => z.id === zone.id)?.booked ?? 0;
    return (parseSpotLimit(zone.capacity) ?? 0) < booked;
  });

  const save = async () => {
    setBusy(true);
    try {
      await saveZones(
        value.zones.map((zone) => ({
          id: zone.id,
          name: zone.name.trim(),
          detail: zone.detail.trim(),
          capacity: parseSpotLimit(zone.capacity) ?? 1,
        })),
      );
      await updateEvent(event.id, {
        bookingTimes: value.bookingTimes,
        priceInfo: value.priceInfo.trim().length > 0 ? value.priceInfo.trim() : null,
        maxPartySize: parseSpotLimit(value.maxPartySize) ?? 8,
      });
      router.back();
    } catch (error) {
      reportSupabaseError(error);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        coverType={event.type}
        footer={
          <Button
            label={t('common.saveChanges')}
            disabled={!isVenueSetupValid(value) || tooSmall !== undefined || busy}
            onPress={() => void save()}
          />
        }
      >
        <Header
          title={t('venue.wizard.setupTitle')}
          subtitle={tooSmall !== undefined ? t('venue.setup.tooSmall', { zone: tooSmall.name }) : event.name}
          showBack
        />
        <VenueSetupForm value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} startTime={event.startTime ?? ''} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
