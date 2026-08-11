import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { formatEventDate } from '@/utils/format';
import { parseIsoDate, toIsoDate } from '@/utils/dateInput';
import { reportSupabaseError } from '@/utils/reportError';

export default function EditEventScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, updateEvent, isOwner } = useEvents();
  const event = getEvent(id);

  const [name, setName] = useState(event?.name ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(event?.welcomeMessage ?? '');

  if (event === undefined || !isOwner(event)) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('editEventForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const save = async () => {
    try {
      await updateEvent(event.id, { name, date, location, welcomeMessage });
      router.back();
    } catch (error) {
      reportSupabaseError(error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label={t('common.saveChanges')}
            disabled={name.trim().length === 0}
            onPress={() => void save()}
          />
        }
      >
        <Header title={t('editEventForm.title')} subtitle={t('editEventForm.subtitle')} showBack />

        <Field label={t('editEventForm.nameLabel')} value={name} onChangeText={setName} />
        <DateTimeField
          label={t('editEventForm.dateLabel')}
          mode="date"
          value={parseIsoDate(date)}
          displayValue={date.trim().length === 0 ? t('editEventForm.selectDate') : formatEventDate(date)}
          onChange={(selected) => setDate(toIsoDate(selected))}
        />
        <Field label={t('editEventForm.locationLabel')} value={location} onChangeText={setLocation} />
        <Field
          label={t('editEventForm.welcomeMessageLabel')}
          value={welcomeMessage}
          onChangeText={setWelcomeMessage}
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
