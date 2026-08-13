import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { requestPasswordReset } = useAuth();
  const { tokens } = useTheme();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    setError(null);
    setBusy(true);
    // Fire-and-forget on the response: showing the same notice whether or
    // not this email has an account is the whole point (no account-existence
    // leak via the UI), so the returned error is deliberately never surfaced.
    await requestPasswordReset(trimmed);
    setBusy(false);
    setNotice(t('forgotPassword.successNotice'));
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenBackground />
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <BackButton />

        <Text style={[styles.headline, { color: tokens.textPrimary }]}>
          {t('forgotPassword.headline')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>
          {t('forgotPassword.subtitle')}
        </Text>

        <View style={styles.form}>
          <Field
            label={t('auth.emailLabel')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
              setNotice(null);
            }}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
          />

          {error !== null ? (
            <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text>
          ) : null}
          {notice !== null ? (
            <Text style={[styles.notice, { color: tokens.accentPrimary }]}>{notice}</Text>
          ) : null}

          <Button
            label={busy ? t('forgotPassword.sending') : t('forgotPassword.sendLink')}
            onPress={() => void submit()}
            disabled={busy}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    gap: spacing.sm,
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    lineHeight: 34,
    marginTop: spacing.lg,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  error: {
    fontSize: 13,
    paddingHorizontal: 4,
  },
  notice: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
});
