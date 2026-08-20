import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Second (and last) step of the phone-auth path — `identifier` is the phone
 * number, display-only plus what gets resent to. The code itself is the
 * entire credential — there's no password anywhere in this flow, and no
 * separate "sign up" step either. On success this establishes a normal
 * session; AuthGate takes it from there — routing a brand-new account to
 * app/auth/complete-profile.tsx for its name, then onboarding, exactly like
 * every other account. This screen doesn't need to know or care which case
 * it is. Previously shared between an email and a phone channel (a `channel`
 * param picked which pair of useAuth functions to call) — email auth is
 * gone now, so that branching is gone too, but the screen itself stayed
 * rather than being duplicated back apart.
 */
export default function VerifyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { verifyPhoneOtp, signInWithPhoneOtp } = useAuth();
  const { tokens } = useTheme();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = setTimeout(() => setCooldown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async () => {
    if (identifier === undefined) return;
    setError(null);

    if (code.trim().length === 0) {
      setError(t('verify.errors.emptyCode'));
      return;
    }

    setBusy(true);
    const err = await verifyPhoneOtp(identifier, code.trim());
    setBusy(false);

    if (err !== null) {
      setError(t('verify.errors.invalidCode'));
      return;
    }

    router.replace('/');
  };

  const resend = async () => {
    if (identifier === undefined || cooldown > 0) return;
    setError(null);
    await signInWithPhoneOtp(identifier);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenBackground />
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BackButton />

        <Text style={[styles.headline, { color: tokens.textPrimary }]}>{t('verify.headline')}</Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>
          {t('verify.subtitle', { identifier: identifier ?? '' })}
        </Text>

        <Field
          label={t('verify.codeLabel')}
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError(null);
          }}
          placeholder={t('verify.codePlaceholder')}
          keyboardType="numeric"
        />
        {error !== null ? <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text> : null}

        <Button
          label={busy ? t('verify.verifyingButton') : t('verify.verifyButton')}
          onPress={() => void submit()}
          disabled={busy || code.trim().length === 0}
          style={styles.submit}
        />

        <TouchableOpacity
          onPress={() => void resend()}
          disabled={cooldown > 0}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={styles.resend}
        >
          <Text
            style={[
              styles.resendText,
              { color: cooldown > 0 ? tokens.textSecondary : tokens.accentPrimary },
            ]}
          >
            {cooldown > 0 ? t('verify.resendCooldown', { seconds: cooldown }) : t('verify.resendCode')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  page: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: spacing.md,
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
    marginBottom: spacing.sm,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  submit: {
    marginTop: spacing.md,
  },
  resend: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
