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
 * Second step of the phone-auth path — the code the OTP was sent to is the
 * credential itself, there's no separate stored password. On success this
 * establishes a normal session (onAuthStateChange fires exactly like an
 * email sign-in), so AuthGate's existing onboarding check already handles
 * routing a brand-new account onward — nothing phone-specific needed there.
 */
export default function PhoneVerifyScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { verifyPhoneOtp, signInWithPhoneOtp } = useAuth();
  const { tokens } = useTheme();
  const { phone } = useLocalSearchParams<{ phone: string }>();

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
    if (phone === undefined) return;
    setError(null);

    if (code.trim().length === 0) {
      setError(t('phoneAuth.errors.emptyCode'));
      return;
    }

    setBusy(true);
    const err = await verifyPhoneOtp(phone, code.trim());
    setBusy(false);

    if (err !== null) {
      setError(t('phoneAuth.errors.invalidCode'));
      return;
    }

    router.replace('/');
  };

  const resend = async () => {
    if (phone === undefined || cooldown > 0) return;
    setError(null);
    await signInWithPhoneOtp(phone);
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

        <Text style={[styles.headline, { color: tokens.textPrimary }]}>{t('phoneAuth.verifyHeadline')}</Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>
          {t('phoneAuth.verifySubtitle', { phone: phone ?? '' })}
        </Text>

        <Field
          label={t('phoneAuth.codeLabel')}
          value={code}
          onChangeText={(value) => {
            setCode(value);
            setError(null);
          }}
          placeholder={t('phoneAuth.codePlaceholder')}
          keyboardType="numeric"
        />
        {error !== null ? <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text> : null}

        <Button
          label={busy ? t('phoneAuth.verifyingButton') : t('phoneAuth.verifyButton')}
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
            {cooldown > 0 ? t('phoneAuth.resendCooldown', { seconds: cooldown }) : t('phoneAuth.resendCode')}
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
