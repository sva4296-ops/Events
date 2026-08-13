import { useLinkingURL } from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';
import { extractRecoveryTokens } from '@/utils/passwordReset';

type SessionState = 'pending' | 'ready' | 'error';

/** Guards against a hung setSession call (network, SDK-internal lock, anything
 * else) leaving the screen on the spinner forever — surfaces as "invalid
 * link" instead, same as a genuinely bad/expired token would. */
const RECOVERY_SESSION_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
}

/**
 * Opened only via the povesteanoastra://reset-password deep link from the
 * "reset your password" email — never navigated to from in-app UI. See
 * utils/passwordReset.ts for why the recovery tokens have to be extracted
 * and fed into setSession by hand here rather than picked up automatically.
 *
 * Uses useLinkingURL(), not the deprecated useURL() — on iOS, expo-router's
 * own routing resolves the initial URL via Linking.getLinkingURL() (the
 * newer Expo native module), while useURL() reads the older, separate
 * RNLinking.getInitialURL() bridge. Those are two different native caches;
 * relying on the one expo-router itself doesn't use is what previously left
 * this screen's url stuck at null (spinner forever) even though routing had
 * already proven the URL was available.
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { setRecoverySession, updatePassword } = useAuth();
  const { tokens } = useTheme();
  const url = useLinkingURL();

  const [sessionState, setSessionState] = useState<SessionState>('pending');
  const handledUrl = useRef<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (url == null || handledUrl.current === url) return;
    handledUrl.current = url;
    // TODO(temporary): remove once the recovery flow is confirmed working
    // end-to-end on a device.
    console.log('[reset-password] received URL:', url);

    const recoveryTokens = extractRecoveryTokens(url);
    console.log('[reset-password] recovery tokens found:', recoveryTokens !== null);
    if (recoveryTokens === null) {
      setSessionState('error');
      return;
    }

    void withTimeout(
      setRecoverySession(recoveryTokens.accessToken, recoveryTokens.refreshToken),
      RECOVERY_SESSION_TIMEOUT_MS,
    ).then((result) => {
      console.log('[reset-password] setRecoverySession result:', result);
      setSessionState(result === null ? 'ready' : 'error');
    });
  }, [url, setRecoverySession]);

  const submit = async () => {
    setError(null);

    if (password.length < 6) {
      setError(t('auth.errors.passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('resetPassword.passwordsDontMatch'));
      return;
    }

    setBusy(true);
    const updateError = await updatePassword(password);
    setBusy(false);

    if (updateError !== null) {
      setError(updateError);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <View style={styles.fill}>
        <ScreenBackground />
        <View style={[styles.content, styles.centered, { paddingTop: insets.top + 40 }]}>
          <Text style={[styles.headline, { color: tokens.textPrimary }]}>
            {t('resetPassword.successHeadline')}
          </Text>
          <Text style={[styles.sub, styles.centeredText, { color: tokens.textSecondary }]}>
            {t('resetPassword.successSubtitle')}
          </Text>
          <Button label={t('resetPassword.continueButton')} onPress={() => router.replace('/')} />
        </View>
      </View>
    );
  }

  if (sessionState !== 'ready') {
    return (
      <View style={styles.fill}>
        <ScreenBackground />
        <View style={[styles.content, styles.centered, { paddingTop: insets.top + 40 }]}>
          {sessionState === 'pending' ? (
            <ActivityIndicator color={tokens.accentPrimary} />
          ) : (
            <>
              <Text style={[styles.headline, { color: tokens.textPrimary }]}>
                {t('resetPassword.invalidLinkHeadline')}
              </Text>
              <Text style={[styles.sub, styles.centeredText, { color: tokens.textSecondary }]}>
                {t('resetPassword.invalidLinkSubtitle')}
              </Text>
              <Button
                label={t('resetPassword.requestNewLink')}
                onPress={() => router.replace('/forgot-password')}
              />
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenBackground />
      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <Text style={[styles.headline, { color: tokens.textPrimary }]}>
          {t('resetPassword.headline')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>
          {t('resetPassword.subtitle')}
        </Text>

        <View style={styles.form}>
          <Field
            label={t('resetPassword.newPasswordLabel')}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError(null);
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
            }}
            placeholder={t('auth.passwordPlaceholderSignUp')}
            secure
          />

          {error !== null ? (
            <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text>
          ) : null}

          <Button
            label={busy ? t('resetPassword.saving') : t('resetPassword.savePassword')}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  centeredText: {
    textAlign: 'center',
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    lineHeight: 34,
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
});
