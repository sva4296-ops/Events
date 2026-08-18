import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { PhoneField } from '@/components/PhoneField';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_COUNTRY_CODE, toE164 } from '@/utils/countryCodes';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';

/**
 * First step of the phone-auth path — reached from /auth's "Continue with
 * phone number" link. supabase.auth.signInWithOtp creates the account on
 * first use, so this same screen covers both a brand-new and a returning
 * phone number; there's no separate phone "sign up" mode.
 */
export default function PhoneAuthScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signInWithPhoneOtp } = useAuth();
  const { tokens } = useTheme();

  const [dialCode, setDialCode] = useState(DEFAULT_COUNTRY_CODE.dialCode);
  const [localNumber, setLocalNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const digits = localNumber.replace(/\D/g, '');
    if (digits.length < 6) {
      setError(t('phoneAuth.errors.invalidPhone'));
      return;
    }

    const phone = toE164(dialCode, localNumber);
    setBusy(true);
    const err = await signInWithPhoneOtp(phone);
    setBusy(false);

    if (err !== null) {
      setError(err);
      return;
    }

    router.push(`/auth/phone-verify?phone=${encodeURIComponent(phone)}`);
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

        <Text style={[styles.headline, { color: tokens.textPrimary }]}>{t('phoneAuth.headline')}</Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('phoneAuth.subtitle')}</Text>

        <PhoneField
          label={t('phoneAuth.phoneLabel')}
          dialCode={dialCode}
          onChangeDialCode={setDialCode}
          localNumber={localNumber}
          onChangeLocalNumber={(value) => {
            setLocalNumber(value);
            setError(null);
          }}
          placeholder={t('phoneAuth.phonePlaceholder')}
        />
        {error !== null ? <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text> : null}

        <Button
          label={busy ? t('phoneAuth.sendingCode') : t('phoneAuth.sendCode')}
          onPress={() => void submit()}
          disabled={busy || localNumber.trim().length === 0}
          style={styles.submit}
        />
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
});
