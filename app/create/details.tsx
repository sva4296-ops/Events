import { router } from 'expo-router';
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
            label="Preview invitation"
            disabled={!canContinue}
            onPress={() => router.push('/create/preview')}
          />
        }
      >
        <Header
          title="The details"
          subtitle="Everything your guests need to know."
          showBack
          onClose={cancel}
          step={2}
          totalSteps={4}
        />

        <Field
          label="Event name"
          value={draft.name}
          onChangeText={(name) => updateDraft({ name })}
          placeholder="Ana & Mihai"
        />
        <DateTimeField
          label="Date"
          mode="date"
          value={parseIsoDate(draft.date)}
          displayValue={draft.date.trim().length === 0 ? 'Select a date' : formatEventDate(draft.date)}
          onChange={(selected) => updateDraft({ date: toIsoDate(selected) })}
        />
        <Field
          label="Location"
          value={draft.location}
          onChangeText={(location) => updateDraft({ location })}
          placeholder="Casa Regală, Brașov"
        />
        <Field
          label="Welcome message"
          value={draft.welcomeMessage}
          onChangeText={(welcomeMessage) => updateDraft({ welcomeMessage })}
          placeholder="We'd love to have you with us on our special day."
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
