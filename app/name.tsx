import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useTheme } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import { spacing } from '@/utils/theme';

/**
 * One-time step, reached only via AuthGate's redirect for any signed-in
 * account with no first_name yet (new email/phone sign-up, or an existing
 * account from before this feature — see AuthGate.tsx). No back button:
 * there's nowhere legitimate to return to, and skipping would defeat the
 * point. AuthGate itself decides where "next" is once firstName is no
 * longer null — this screen just saves and lets that redirect happen.
 */
export default function NameStepScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { saveName } = useUserProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await saveName(firstName.trim(), lastName.trim());
    } catch {
      setError(t('nameStep.errorSaving'));
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        footer={
          <Button
            label={busy ? t('nameStep.saving') : t('nameStep.continue')}
            disabled={!canSubmit || busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header title={t('nameStep.title')} subtitle={t('nameStep.subtitle')} />

        <Field
          label={t('nameStep.firstNameLabel')}
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            setError(null);
          }}
          placeholder={t('nameStep.firstNamePlaceholder')}
        />
        <Field
          label={t('nameStep.lastNameLabel')}
          value={lastName}
          onChangeText={(value) => {
            setLastName(value);
            setError(null);
          }}
          placeholder={t('nameStep.lastNamePlaceholder')}
        />

        {error !== null ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text>
        ) : null}
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
