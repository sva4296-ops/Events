import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';
import { formatEventDate } from '@/utils/format';
import { parseIsoDate, toIsoDate } from '@/utils/dateInput';
import { reportSupabaseError } from '@/utils/reportError';

export default function EditEventScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, updateEvent, deleteEvent, isOwner } = useEvents();
  const event = getEvent(id);

  const [name, setName] = useState(event?.name ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(event?.welcomeMessage ?? '');
  const [deleting, setDeleting] = useState(false);

  // The event leaves the cache the moment the delete succeeds, a frame before
  // navigation lands; render nothing then instead of "not available".
  if (event === undefined && deleting) return <Screen>{null}</Screen>;

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

  const remove = () =>
    confirmDelete(t('editEventForm.deleteTitle'), t('editEventForm.deleteBody', { name: event.name }), () => {
      setDeleting(true);
      deleteEvent(event.id)
        .then(() => router.dismissTo('/'))
        .catch((error: unknown) => {
          setDeleting(false);
          reportSupabaseError(error);
        });
    });

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

        <View style={styles.danger}>
          <Button
            label={deleting ? t('editEventForm.deleting') : t('editEventForm.deleteButton')}
            variant="danger"
            disabled={deleting}
            onPress={remove}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  danger: {
    marginTop: 24,
  },
});
