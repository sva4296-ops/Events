import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PhoneField } from '@/components/PhoneField';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_COUNTRY_CODE, toE164 } from '@/utils/countryCodes';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';

/**
 * The one auth screen — phone number is the only sign-in/sign-up method
 * (Supabase's OTP call already creates the account on first use, so there's
 * nothing to separate). No password, no account-type choice, no email path
 * at all — email is a plain, optional profile field now (app/edit-profile.tsx),
 * never an identifier used here. Business/agency accounts aren't part of this
 * flow either — that's a Profile action for an already-signed-in user, see
 * app/agency-signup.tsx.
 */
export default function AuthScreen() {
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
    router.push(`/auth/verify?identifier=${encodeURIComponent(phone)}`);
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScreenBackground />
      <View style={[styles.content, { paddingTop: insets.top + 64 }]}>
        <Text style={[styles.headline, { color: tokens.textPrimary }]}>{t('auth.headline')}</Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('auth.subtitle')}</Text>

        <View style={styles.form}>
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
            label={busy ? t('auth.sendingCode') : t('auth.sendCode')}
            onPress={() => void submit()}
            disabled={busy || localNumber.trim().length === 0}
            style={styles.submit}
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
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'center',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  form: {
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  submit: {
    marginTop: spacing.sm,
  },
});
