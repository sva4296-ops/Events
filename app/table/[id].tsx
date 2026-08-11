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

export default function SeatingTableScreen() {
  const { t } = useTranslation();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveSeatingTable } = useEventContent(id ?? '');

  const existing = content?.seatingTables.find((table) => table.id === itemId) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [seatCount, setSeatCount] = useState(existing === null ? '' : String(existing.seat_count));

  if (!isOwner(event) || content === null) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('tableForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const save = () => {
    const parsed = Number.parseInt(seatCount, 10);
    saveSeatingTable({
      id: existing?.id ?? null,
      name: name.trim(),
      label,
      seat_count: Number.isFinite(parsed) ? parsed : 0,
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
            label={existing === null ? t('tableForm.addButton') : t('common.saveChanges')}
            disabled={name.trim().length === 0}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? t('tableForm.addTitle') : t('tableForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
        />

        <Field
          label={t('tableForm.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('tableForm.namePlaceholder')}
        />
        <Field
          label={t('tableForm.labelLabel')}
          value={label}
          onChangeText={setLabel}
          placeholder={t('tableForm.labelPlaceholder')}
        />
        <Field
          label={t('tableForm.seatsLabel')}
          value={seatCount}
          onChangeText={setSeatCount}
          placeholder={t('tableForm.seatsPlaceholder')}
          keyboardType="numeric"
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
