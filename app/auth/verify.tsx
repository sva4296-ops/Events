import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { OtpInput } from '@/components/OtpInput';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { typography } from '@/utils/themeTokens';

const RESEND_COOLDOWN_SECONDS = 30;
const CODE_LENGTH = 6;

function formatCooldown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

/**
 * Second (and last) step of the phone-auth path — `identifier` is the phone
 * number, display-only plus what gets resent to. The code itself is the
 * entire credential — there's no password anywhere in this flow, and no
 * separate "sign up" step either. On success this establishes a normal
 * session; AuthGate takes it from there — routing a brand-new account to
 * app/auth/complete-profile.tsx for its name, then onboarding, exactly like
 * every other account. This screen doesn't need to know or care which case
 * it is.
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

  const submit = async (value: string = code) => {
    if (identifier === undefined || busy) return;
    setError(null);

    if (value.trim().length === 0) {
      setError(t('verify.errors.emptyCode'));
      return;
    }

    setBusy(true);
    const err = await verifyPhoneOtp(identifier, value.trim());
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
    <LinearGradient colors={tokens.background} style={styles.fill}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BackButton />

          <View style={styles.intro}>
            <Text style={[styles.headline, { color: tokens.textPrimary }]}>{t('verify.headline')}</Text>
            <Text style={[styles.sub, { color: tokens.textSecondary }]}>
              {t('verify.sentTo')}
              <Text style={[styles.strong, { color: tokens.textPrimary }]}>{identifier ?? ''}</Text>
              {'. '}
              <Text
                style={[styles.link, { color: tokens.accentText }]}
                onPress={() => router.back()}
                accessibilityRole="link"
              >
                {t('verify.changeNumber')}
              </Text>
            </Text>
          </View>

          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
              if (value.length === CODE_LENGTH) void submit(value);
            }}
            length={CODE_LENGTH}
            accessibilityLabel={t('verify.codeLabel')}
            invalid={error !== null}
          />
          {error !== null ? (
            <Text style={[styles.error, { color: tokens.statusDeclined }]}>{error}</Text>
          ) : null}

          {cooldown > 0 ? (
            <View style={styles.resendRow}>
              <Feather name="clock" size={18} color={tokens.textSecondary} />
              <Text style={[styles.resendText, { color: tokens.textSecondary }]}>
                {t('verify.resendIn')}
                <Text style={[styles.strong, { color: tokens.textPrimary }]}>{formatCooldown(cooldown)}</Text>
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => void resend()}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={styles.resendButton}
            >
              <Text style={[styles.link, { color: tokens.accentText }]}>{t('verify.resendCode')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button
            label={busy ? t('verify.verifyingButton') : t('verify.verifyButton')}
            onPress={() => void submit()}
            disabled={busy || code.length < CODE_LENGTH}
          />
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: 28,
  },
  intro: {
    gap: 10,
  },
  headline: {
    ...typography.title1,
    fontSize: 30,
    lineHeight: 36,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    fontWeight: '700',
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -spacing.md,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resendText: {
    fontSize: 14,
  },
  resendButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
  },
});
