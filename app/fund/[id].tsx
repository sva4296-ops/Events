import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';

export default function FundFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveFund } = useEventContent(id ?? '');

  const existing = content?.fund ?? null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [target, setTarget] = useState(existing === null ? '' : String(existing.target_amount));
  const [currency, setCurrency] = useState(existing?.currency ?? 'RON');

  if (!isOwner(event)) {
    return (
      <Screen>
        <Header title="Not available" subtitle="Only the organizer can manage the fund." showBack />
      </Screen>
    );
  }

  const amount = Number.parseFloat(target.replace(',', '.'));
  const valid = title.trim().length > 0 && Number.isFinite(amount) && amount > 0;

  const save = () => {
    saveFund({
      title: title.trim(),
      description: description.trim(),
      target_amount: amount,
      currency: currency.trim().toUpperCase(),
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
            label={existing === null ? 'Set up fund' : 'Save fund'}
            disabled={!valid}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? 'Set up a fund' : 'Edit the fund'}
          subtitle="Guests will see this on the Fond tab."
          showBack
        />

        <Field
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder="Luna de miere în Grecia"
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="A short personal message to your guests."
          multiline
        />
        <Field
          label="Target amount"
          value={target}
          onChangeText={setTarget}
          placeholder="8000"
          keyboardType="numeric"
        />
        <Field label="Currency" value={currency} onChangeText={setCurrency} placeholder="RON" />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
