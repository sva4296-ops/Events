import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';

export default function VenueScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, updateVenue } = useEventContent(id ?? '');

  const [name, setName] = useState(content?.venue.name ?? '');
  const [address, setAddress] = useState(content?.venue.address ?? '');
  const [notes, setNotes] = useState((content?.venue.notes ?? []).join('\n'));

  if (!isOwner(event) || content === null) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('venueForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

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
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={<Button label={t('venueForm.saveButton')} disabled={name.trim().length === 0} onPress={save} />}
      >
        <Header
          title={content.venue.name.trim().length === 0 ? t('venueForm.setTitle') : t('venueForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
        />

        <Field label={t('venueForm.nameLabel')} value={name} onChangeText={setName} />
        <Field label={t('venueForm.addressLabel')} value={address} onChangeText={setAddress} />
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
