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
 * "Complete your profile" — one-time first/last name step for any signed-in
 * account with no first_name yet, old or new, email or phone. Reached only
 * via AuthGate's redirect (the same gate that already handles onboarding),
 * not owned by any particular auth screen — the auth flow itself (Screen 1
 * / verify) is identifier-and-code only and never collects a name. No back
 * button: nowhere legitimate to return to, and skipping would defeat the
 * point. This screen doesn't navigate on success — AuthGate reacts to
 * firstName going from null to set and moves on by itself, same mechanism
 * it already uses for onboarding.
 */
export default function CompleteProfileScreen() {
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
    } finally {
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
