import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';

export default function VendorScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveVendor } = useEventContent(id ?? '');

  const existing = content?.vendors.find((vendor) => vendor.id === itemId) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [handle, setHandle] = useState(existing?.handle ?? '');
  const [externalUrl, setExternalUrl] = useState(existing?.external_url ?? '');

  if (!isOwner(event) || content === null) {
    return (
      <Screen>
        <Header title="Not available" subtitle="Only the organizer can edit vendors." showBack />
      </Screen>
    );
  }

  const save = () => {
    saveVendor({
      id: existing?.id ?? null,
      name: name.trim(),
      category,
      handle,
      external_url: externalUrl.trim(),
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
            label={existing === null ? 'Add vendor' : 'Save changes'}
            disabled={name.trim().length === 0}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? 'Add a vendor' : 'Edit vendor'}
          subtitle="Guests will see this on the Detalii tab."
          showBack
        />

        <Field label="Nume" value={name} onChangeText={setName} placeholder="Studio Lumière" />
        <Field
          label="Categorie"
          value={category}
          onChangeText={setCategory}
          placeholder="Foto & Video"
        />
        <Field label="Handle" value={handle} onChangeText={setHandle} placeholder="@studiolumiere" />
        <Field
          label="Link extern"
          value={externalUrl}
          onChangeText={setExternalUrl}
          placeholder="https://instagram.com/studiolumiere"
          keyboardType="default"
          hint="Opțional — apare ca buton „Vezi”."
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
