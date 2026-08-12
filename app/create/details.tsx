import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { parseIsoDate, toIsoDate } from '@/utils/dateInput';
import { formatEventDate } from '@/utils/format';

/** Local midnight, not `new Date()` as-is — a same-day event must still count as valid regardless of the current time of day. */
function todayAtLocalMidnight(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export default function EventDetailsScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const [dateError, setDateError] = useState<string | null>(null);
  const canContinue = draft.name.trim().length > 0 && draft.date.trim().length > 0;

  const handleContinue = () => {
    // Backstop, not just UI prevention: minimumDate on the picker below can't
    // catch manual text entry or picker-library edge cases, so the date is
    // re-validated here regardless of how it was set.
    if (parseIsoDate(draft.date) < todayAtLocalMidnight()) {
      setDateError(t('createWizard.pastDateError'));
      return;
    }
    router.push('/create/preview');
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label={t('createWizard.detailsButton')}
            disabled={!canContinue}
            onPress={handleContinue}
          />
        }
      >
        <Header
          title={t('createWizard.detailsTitle')}
          subtitle={t('createWizard.detailsSubtitle')}
          showBack
          onClose={cancel}
          step={2}
          totalSteps={4}
        />

        <Field
          label={t('editEventForm.nameLabel')}
          value={draft.name}
          onChangeText={(name) => updateDraft({ name })}
          placeholder={t('createWizard.namePlaceholder')}
        />
        <DateTimeField
          label={t('editEventForm.dateLabel')}
          mode="date"
          value={parseIsoDate(draft.date)}
          displayValue={
            draft.date.trim().length === 0 ? t('editEventForm.selectDate') : formatEventDate(draft.date)
          }
          onChange={(selected) => {
            updateDraft({ date: toIsoDate(selected) });
            setDateError(null);
          }}
          minimumDate={todayAtLocalMidnight()}
        />
        {dateError !== null ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{dateError}</Text>
        ) : null}
        <Field
          label={t('editEventForm.locationLabel')}
          value={draft.location}
          onChangeText={(location) => updateDraft({ location })}
          placeholder={t('createWizard.locationPlaceholder')}
        />
        <Field
          label={t('editEventForm.welcomeMessageLabel')}
          value={draft.welcomeMessage}
          onChangeText={(welcomeMessage) => updateDraft({ welcomeMessage })}
          placeholder={t('createWizard.welcomeMessagePlaceholder')}
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
  error: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
});
