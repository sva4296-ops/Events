import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { type PickedLocation } from '@/components/MapPickerModal';
import { MapPointField } from '@/components/MapPointField';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';

export default function VenueScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isVenueManager } = useEvents();
  const event = getEvent(id);
  const { content, updateVenue, deleteVenue } = useEventContent(id ?? '');

  const [name, setName] = useState(content?.venue.name ?? '');
  const [address, setAddress] = useState(content?.venue.address ?? '');
  const [notes, setNotes] = useState((content?.venue.notes ?? []).join('\n'));
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    content !== null && content.venue.latitude !== null && content.venue.longitude !== null
      ? { latitude: content.venue.latitude, longitude: content.venue.longitude }
      : null,
  );

  if (!isVenueManager(event) || content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('venueForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  // The saved venue (not the form's draft): only an existing location can be deleted.
  const savedVenueName = content.venue.name.trim() || content.venue.address.trim();
  const hasSavedVenue = savedVenueName.length > 0;

  const save = () => {
    updateVenue({
      event_id: id ?? '',
      name,
      address,
      notes: notes
        .split('\n')
        .map((note) => note.trim())
        .filter((note) => note.length > 0),
      map_image_url: content.venue.map_image_url,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    });
    router.back();
  };

  const onPick = (picked: PickedLocation) => {
    setCoords({ latitude: picked.latitude, longitude: picked.longitude });
    if (picked.address !== null) setAddress(picked.address);
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        coverType={event?.type}
        footer={<Button label={t('venueForm.saveButton')} disabled={name.trim().length === 0} onPress={save} />}
      >
        <Header
          title={content.venue.name.trim().length === 0 ? t('venueForm.setTitle') : t('venueForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
          right={
            hasSavedVenue ? (
              <IconCircleButton
                icon="trash-2"
                tone="destructive"
                accessibilityLabel={t('common.delete')}
                onPress={() =>
                  confirmDelete(t('detalii.deleteVenueTitle'), t('detalii.deleteVenueBody', { name: savedVenueName }), () => {
                    deleteVenue();
                    router.back();
                  })
                }
              />
            ) : undefined
          }
        />

        <Field label={t('venueForm.nameLabel')} value={name} onChangeText={setName} />
        <Field label={t('venueForm.addressLabel')} value={address} onChangeText={setAddress} />

        <MapPointField value={coords} onPick={onPick} onClear={() => setCoords(null)} />

        <Field
          label={t('venueForm.notesLabel')}
          value={notes}
          onChangeText={setNotes}
          hint={t('venueForm.notesHint')}
          multiline
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
