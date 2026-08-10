import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';

export default function VenueScreen() {
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
        <Header title="Not available" subtitle="Only the organizer can edit the venue." showBack />
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
        footer={<Button label="Save venue" disabled={name.trim().length === 0} onPress={save} />}
      >
        <Header
          title={content.venue.name.trim().length === 0 ? 'Set the venue' : 'Edit the venue'}
          subtitle="Guests will see this on the Detalii tab."
          showBack
        />

        <Field label="Venue name" value={name} onChangeText={setName} />
        <Field label="Address" value={address} onChangeText={setAddress} />
        <Field
          label="Practical notes"
          value={notes}
          onChangeText={setNotes}
          hint="One note per line."
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
