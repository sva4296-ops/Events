import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { PhoneField } from '@/components/PhoneField';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_COUNTRY_CODE, toE164 } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';
import { brandGradient, typography } from '@/utils/themeTokens';
import { INVITE_SITE_URL } from '@/utils/whatsappInvite';

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
  const { width } = useWindowDimensions();
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
    <LinearGradient colors={tokens.background} style={styles.fill}>
      {/* Decorative "story thread" across the top, behind everything. */}
      <View style={[styles.thread, { top: insets.top }]} pointerEvents="none">
        <Svg width={width} height={220} viewBox="0 0 390 220" preserveAspectRatio="none">
          <Defs>
            <SvgGradient id="authThread" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={brandGradient[0]} />
              <Stop offset="0.5" stopColor={brandGradient[1]} />
              <Stop offset="1" stopColor={brandGradient[2]} />
            </SvgGradient>
          </Defs>
          <Path
            d="M-20 170C60 170 90 60 170 70S290 190 410 40"
            stroke="url(#authThread)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            opacity={0.55}
          />
        </Svg>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 52 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brand}>
            <BrandMark width={52} />
            <Text style={[styles.brandName, { color: tokens.textPrimary }]}>PovesteaNoastra</Text>
          </View>

          <View style={styles.intro}>
            <Text style={[styles.headline, { color: tokens.textPrimary }]}>{t('auth.headline')}</Text>
            <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('auth.subtitle')}</Text>
          </View>

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
            hint={t('auth.smsHint')}
            error={error}
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Button
            label={busy ? t('auth.sendingCode') : t('auth.sendCode')}
            onPress={() => void submit()}
            disabled={busy || localNumber.trim().length === 0}
          />
          <Text style={[styles.legal, { color: tokens.textSecondary }]}>
            {t('auth.legalPrefix')}
            <Text
              style={[styles.legalLink, { color: tokens.accentText }]}
              onPress={() => void Linking.openURL(`${INVITE_SITE_URL}/termeni`)}
              accessibilityRole="link"
            >
              {t('auth.legalTerms')}
            </Text>
            {t('auth.legalAnd')}
            <Text
              style={[styles.legalLink, { color: tokens.accentText }]}
              onPress={() => void Linking.openURL(`${INVITE_SITE_URL}/confidentialitate`)}
              accessibilityRole="link"
            >
              {t('auth.legalPrivacy')}
            </Text>
            {t('auth.legalSuffix')}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  thread: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginTop: 40,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: 36,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandName: {
    fontFamily: typography.title1.fontFamily,
    fontSize: 20,
  },
  intro: {
    gap: spacing.md,
  },
  headline: {
    ...typography.display,
  },
  sub: {
    fontFamily: typography.quote.fontFamily,
    fontSize: 19,
    lineHeight: 27,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.lg,
    gap: 14,
  },
  legal: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  legalLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
