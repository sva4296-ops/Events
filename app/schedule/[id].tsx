import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
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
        <Header title="Not available" subtitle="Only the organizer can edit the schedule." showBack />
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label={existing === null ? 'Add to schedule' : 'Save changes'}
            disabled={title.trim().length === 0}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? 'Add a schedule item' : 'Edit schedule item'}
          subtitle="Guests will see this on the Detalii tab."
          showBack
        />

        <DateTimeField
          label="Time"
          mode="time"
          value={parseTimeString(time)}
          displayValue={time.trim().length === 0 ? 'Select a time' : time}
          onChange={(selected) => setTime(toTimeString(selected))}
        />
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="Ceremonie" />
        <Field
          label="Where"
          value={location}
          onChangeText={setLocation}
          placeholder="Biserica Sfântul Nicolae"
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
