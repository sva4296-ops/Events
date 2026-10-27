import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { LocationField, type MapPoint } from '@/components/LocationField';
import { type PickedLocation } from '@/components/MapPickerModal';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';

export default function AccommodationScreen() {
  const { t } = useTranslation();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveAccommodation, deleteAccommodation } = useEventContent(id ?? '');

  const existing = content?.accommodations.find((entry) => entry.id === itemId) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [detailLine, setDetailLine] = useState(existing?.detail_line ?? '');
  const [priceLine, setPriceLine] = useState(existing?.price_line ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [coords, setCoords] = useState<MapPoint | null>(
    existing !== null && existing.latitude !== null && existing.longitude !== null
      ? { latitude: existing.latitude, longitude: existing.longitude }
      : null,
  );

  if (!isOwner(event) || content === null) {
    return (
      <Screen coverTheme={event?.coverTheme}>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('accommodationForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const save = () => {
    saveAccommodation({
      id: existing?.id ?? null,
      name: name.trim(),
      detail_line: detailLine,
      price_line: priceLine,
      location: location.trim(),
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    });
    router.back();
  };

  const onPick = (picked: PickedLocation) => {
    setCoords({ latitude: picked.latitude, longitude: picked.longitude });
    if (picked.address !== null) setLocation(picked.address);
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        coverTheme={event?.coverTheme}
        footer={
          <Button
            label={existing === null ? t('accommodationForm.addTitle') : t('common.saveChanges')}
            disabled={name.trim().length === 0}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? t('accommodationForm.addTitle') : t('accommodationForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
          right={
            existing !== null ? (
              <IconCircleButton
                icon="trash-2"
                tone="destructive"
                accessibilityLabel={t('common.delete')}
                onPress={() =>
                  confirmDelete(t('detalii.deleteAccommodationTitle'), t('detalii.deleteAccommodationBody', { name: existing.name }), async () => {
                    await deleteAccommodation(existing.id);
                    router.back();
                  })
                }
              />
            ) : undefined
          }
        />

        <Field
          label={t('accommodationForm.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('accommodationForm.namePlaceholder')}
        />
        <LocationField
          label={t('accommodationForm.locationLabel')}
          value={location}
          onChangeText={setLocation}
          placeholder={t('accommodationForm.locationPlaceholder')}
          coords={coords}
          onPick={onPick}
          onClearCoords={() => setCoords(null)}
        />
        <Field
          label={t('accommodationForm.detailsLabel')}
          value={detailLine}
          onChangeText={setDetailLine}
          placeholder={t('accommodationForm.detailsPlaceholder')}
        />
        <Field
          label={t('accommodationForm.priceLabel')}
          value={priceLine}
          onChangeText={setPriceLine}
          placeholder={t('accommodationForm.pricePlaceholder')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
