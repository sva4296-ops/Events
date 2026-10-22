import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity } from 'react-native';

import { AiWriteButton } from '@/components/AiWriteButton';
import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { LocationField } from '@/components/LocationField';
import { Header } from '@/components/Header';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { formatEventDate } from '@/utils/format';
import { parseIsoDate, parseTimeString, toIsoDate, toTimeString } from '@/utils/dateInput';
import { reportSupabaseError } from '@/utils/reportError';
import { parseSpotLimit } from '@/utils/spontaneous';
import { themeRadius } from '@/utils/themeTokens';

export default function EditEventScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, updateEvent, deleteEvent, isOwner, isPrimaryOwner } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);

  const [name, setName] = useState(event?.name ?? '');
  const [date, setDate] = useState(event?.date ?? '');
  const [location, setLocation] = useState(event?.location ?? '');
  const [welcomeMessage, setWelcomeMessage] = useState(event?.welcomeMessage ?? '');
  const [deleting, setDeleting] = useState(false);
  // Spontaneous events only.
  const [startTime, setStartTime] = useState(event?.startTime ?? '');
  const [replyBy, setReplyBy] = useState(event?.replyBy ?? '');
  const [spotLimit, setSpotLimit] = useState(event?.spotLimit != null ? String(event.spotLimit) : '');

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
      await updateEvent(event.id, {
        name,
        date,
        location,
        welcomeMessage,
        ...(event.type === 'venue' ? { startTime: startTime.trim().length > 0 ? startTime : null } : {}),
        ...(event.type === 'spontaneous'
          ? {
              startTime: startTime.trim().length > 0 ? startTime : null,
              replyBy: replyBy.trim().length > 0 ? replyBy : null,
              spotLimit: parseSpotLimit(spotLimit),
            }
          : {}),
      });
      router.back();
    } catch (error) {
      reportSupabaseError(error);
    }
  };

  const remove = () =>
    confirmDelete(t('editEventForm.deleteTitle'), t('editEventForm.deleteBody', { name: event.name }), () => {
      setDeleting(true);
      return deleteEvent(event.id)
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
        coverType={event?.type}
        footer={
          <Button
            label={t('common.saveChanges')}
            disabled={name.trim().length === 0}
            onPress={() => void save()}
          />
        }
      >
        <Header
          title={t('editEventForm.title')}
          subtitle={t('editEventForm.subtitle')}
          showBack
          right={
            // Co-organizers edit details too; deleting stays with the owner.
            isPrimaryOwner(event) ? (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
              onPress={remove}
              disabled={deleting}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('editEventForm.deleteButton')}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={tokens.statusDeclined} />
              ) : (
                <Feather name="trash-2" size={20} color={tokens.statusDeclined} />
              )}
            </TouchableOpacity>
            ) : undefined
          }
        />

        <Field label={t('editEventForm.nameLabel')} value={name} onChangeText={setName} />
        <DateTimeField
          label={t('editEventForm.dateLabel')}
          mode="date"
          value={parseIsoDate(date)}
          displayValue={date.trim().length === 0 ? t('editEventForm.selectDate') : formatEventDate(date)}
          onChange={(selected) => setDate(toIsoDate(selected))}
        />
        {event.type === 'spontaneous' || event.type === 'venue' ? (
          <DateTimeField
            label={t('spontaneous.wizard.timeLabel')}
            mode="time"
            value={parseTimeString(startTime.trim().length > 0 ? startTime : '21:00')}
            displayValue={startTime.trim().length > 0 ? startTime : t('spontaneous.wizard.timePlaceholder')}
            onChange={(selected) => setStartTime(toTimeString(selected))}
          />
        ) : null}
        {event.type === 'spontaneous' ? (
          <>
            <DateTimeField
              label={t('spontaneous.wizard.replyByLabel')}
              mode="date"
              value={parseIsoDate(replyBy.trim().length > 0 ? replyBy : date)}
              displayValue={replyBy.trim().length === 0 ? t('spontaneous.wizard.replyByNone') : formatEventDate(replyBy)}
              onChange={(selected) => setReplyBy(toIsoDate(selected))}
            />
            <Field
              label={t('spontaneous.wizard.spotLimitLabel')}
              value={spotLimit}
              onChangeText={(value) => setSpotLimit(value.replace(/[^0-9]/g, ''))}
              placeholder={t('spontaneous.wizard.spotLimitPlaceholder')}
              keyboardType="numeric"
              hint={t('spontaneous.wizard.spotLimitHint')}
            />
          </>
        ) : null}
        <LocationField
          label={t('editEventForm.locationLabel')}
          value={location}
          onChangeText={setLocation}
          onPick={(picked) => {
            if (picked.address !== null) setLocation(picked.address);
          }}
        />
        <Field
          label={t('editEventForm.welcomeMessageLabel')}
          value={welcomeMessage}
          onChangeText={setWelcomeMessage}
          multiline
          action={
            <AiWriteButton
              kind="welcome"
              value={welcomeMessage}
              onChange={setWelcomeMessage}
              maxChars={280}
              context={{ type: event?.type ?? null, name, date, location }}
            />
          }
        />

        {isPrimaryOwner(event) ? (
          <ListGroup>
            <ListRow
              icon="users"
              label={t('editEventForm.coOrganizers')}
              value={event.coOrganizers.length > 0 ? String(event.coOrganizers.length) : undefined}
              onPress={() => router.push(`/co-organizers/${event.id}`)}
            />
          </ListGroup>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
