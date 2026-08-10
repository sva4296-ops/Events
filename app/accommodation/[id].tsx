import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';

export default function AccommodationScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveAccommodation } = useEventContent(id ?? '');

  const existing = content?.accommodations.find((entry) => entry.id === itemId) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [detailLine, setDetailLine] = useState(existing?.detail_line ?? '');
  const [priceLine, setPriceLine] = useState(existing?.price_line ?? '');

  if (!isOwner(event) || content === null) {
    return (
      <Screen>
        <Header
          title="Not available"
          subtitle="Only the organizer can edit accommodation options."
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
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label={existing === null ? 'Add accommodation' : 'Save changes'}
            disabled={name.trim().length === 0}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? 'Add accommodation' : 'Edit accommodation'}
          subtitle="Guests will see this on the Detalii tab."
          showBack
        />

        <Field label="Nume" value={name} onChangeText={setName} placeholder="Hotel Castel" />
        <Field
          label="Detalii"
          value={detailLine}
          onChangeText={setDetailLine}
          placeholder="4★ · 2 min de castel"
        />
        <Field
          label="Preț"
          value={priceLine}
          onChangeText={setPriceLine}
          placeholder="de la 320 lei/noapte"
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
