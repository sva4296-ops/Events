import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const { updatePassword } = useAuth();
  const { tokens } = useTheme();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError(t('auth.errors.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordsDontMatch'));
      return;
    }

    setBusy(true);
    // No current-password re-entry: the existing signed-in session is
    // already sufficient authorization, same as every other Profile action.
    const updateError = await updatePassword(password);
    setBusy(false);

    if (updateError !== null) {
      setError(updateError);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setNotice(t('changePassword.successNotice'));
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        footer={
          <Button
            label={busy ? t('changePassword.saving') : t('common.saveChanges')}
            disabled={busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header title={t('changePassword.title')} subtitle={t('changePassword.subtitle')} showBack />

        <Field
          label={t('changePassword.newPasswordLabel')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setError(null);
            setNotice(null);
          }}
          placeholder={t('auth.passwordPlaceholderSignUp')}
          secure
        />
        <Field
          label={t('resetPassword.confirmPasswordLabel')}
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setError(null);
            setNotice(null);
          }}
          placeholder={t('auth.passwordPlaceholderSignUp')}
          secure
        />

        {error !== null ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text>
        ) : null}
        {notice !== null ? (
          <Text style={[styles.notice, { color: tokens.accentPrimary }]}>{notice}</Text>
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
  notice: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
});
