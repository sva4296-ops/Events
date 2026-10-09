import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { type PickedLocation } from '@/components/MapPickerModal';
import { MapPointField, type MapPoint } from '@/components/MapPointField';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { parseTimeString, toTimeString } from '@/utils/dateInput';
import { confirmDelete } from '@/utils/confirm';

export default function ScheduleItemScreen() {
  const { t } = useTranslation();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveScheduleItem, deleteScheduleItem } = useEventContent(id ?? '');

  const existing = content?.schedule.find((item) => item.id === itemId) ?? null;

  const [time, setTime] = useState(existing?.time ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [coords, setCoords] = useState<MapPoint | null>(
    existing !== null && existing.latitude !== null && existing.longitude !== null
      ? { latitude: existing.latitude, longitude: existing.longitude }
      : null,
  );

  if (!isOwner(event) || content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('scheduleForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const save = () => {
    saveScheduleItem({
      id: existing?.id ?? null,
      time,
      title: title.trim(),
      location,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    });
    router.back();
  };

  // "Unde" usually holds a place name; only fill it from the map when it's still empty.
  const onPick = (picked: PickedLocation) => {
    setCoords({ latitude: picked.latitude, longitude: picked.longitude });
    if (location.trim().length === 0 && picked.address !== null) setLocation(picked.address);
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        coverType={event?.type}
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
          right={
            existing !== null ? (
              <IconCircleButton
                icon="trash-2"
                tone="destructive"
                accessibilityLabel={t('common.delete')}
                onPress={() =>
                  confirmDelete(t('detalii.deleteScheduleTitle'), t('detalii.deleteScheduleBody', { title: existing.title }), () => {
                    deleteScheduleItem(existing.id);
                    router.back();
                  })
                }
              />
            ) : undefined
          }
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
        <MapPointField value={coords} onPick={onPick} onClear={() => setCoords(null)} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
