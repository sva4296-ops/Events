import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { parseTimeString, toTimeString } from '@/utils/dateInput';

export default function ScheduleItemScreen() {
  const { t } = useTranslation();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveScheduleItem } = useEventContent(id ?? '');

  const existing = content?.schedule.find((item) => item.id === itemId) ?? null;

  const [time, setTime] = useState(existing?.time ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');

  if (!isOwner(event) || content === null) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('scheduleForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const save = () => {
    saveScheduleItem({ id: existing?.id ?? null, time, title: title.trim(), location });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        footer={
          <Button
            label={existing === null ? t('scheduleForm.addButton') : t('common.saveChanges')}
            disabled={title.trim().length === 0}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? t('scheduleForm.addTitle') : t('scheduleForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
        />

        <DateTimeField
          label={t('scheduleForm.timeLabel')}
          mode="time"
          value={parseTimeString(time)}
          displayValue={time.trim().length === 0 ? t('scheduleForm.selectTime') : time}
          onChange={(selected) => setTime(toTimeString(selected))}
        />
        <Field
          label={t('scheduleForm.titleLabel')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('scheduleForm.titlePlaceholder')}
        />
        <Field
          label={t('scheduleForm.whereLabel')}
          value={location}
          onChangeText={setLocation}
          placeholder={t('scheduleForm.wherePlaceholder')}
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
