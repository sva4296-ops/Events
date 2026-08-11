import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { parseIsoDate, toIsoDate } from '@/utils/dateInput';
import { formatEventDate } from '@/utils/format';

export default function EventDetailsScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const canContinue = draft.name.trim().length > 0 && draft.date.trim().length > 0;

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
            onPress={() => router.push('/create/preview')}
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
          onChange={(selected) => updateDraft({ date: toIsoDate(selected) })}
        />
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
});
