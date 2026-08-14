import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { mapAuthError, type AuthFieldErrors } from '@/utils/authErrors';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Romanian CUI: 2-10 digits, optional "RO" prefix for VAT-registered agencies.
const CUI_PATTERN = /^RO?\d{2,10}$/i;

interface FieldErrors extends AuthFieldErrors {
  companyName?: string;
  cui?: string;
}

export default function AgencySignupScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const { tokens } = useTheme();

  const [companyName, setCompanyName] = useState('');
  const [cui, setCui] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): boolean => {
    const next: FieldErrors = {};

    if (companyName.trim().length === 0) {
      next.companyName = t('agencySignup.errors.companyNameRequired');
    }
    if (!CUI_PATTERN.test(cui.trim())) {
      next.cui = t('agencySignup.errors.cuiInvalid');
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = t('auth.errors.invalidEmail');
    }
    if (password.length === 0) {
      next.password = t('auth.errors.emptyPassword');
    } else if (password.length < 6) {
      next.password = t('auth.errors.passwordTooShort');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setNotice(null);
    if (!validate()) return;

    setBusy(true);
    const error = await signUp(email.trim(), password, {
      companyName: companyName.trim(),
      cui: cui.trim().toUpperCase(),
      registrationNumber: registrationNumber.trim().length > 0 ? registrationNumber.trim() : undefined,
      address: address.trim().length > 0 ? address.trim() : undefined,
    });
    setBusy(false);

    if (error !== null) {
      setErrors(mapAuthError(error));
      return;
    }

    // Same as individual sign-up: email confirmation is ON, so there's no
    // session yet — the agency row already exists though (handle_new_user()
    // creates it from the signup metadata immediately, before confirmation).
    setNotice(t('auth.accountCreatedNotice'));
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

        <Text style={[styles.headline, { color: tokens.textPrimary }]}>
          {t('agencySignup.headline')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('agencySignup.subtitle')}</Text>

        <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>
          {t('agencySignup.companySection')}
        </Text>
        <Field
          label={t('agencySignup.companyNameLabel')}
          value={companyName}
          onChangeText={(value) => {
            setCompanyName(value);
            setErrors((current) => ({ ...current, companyName: undefined }));
          }}
          placeholder={t('agencySignup.companyNamePlaceholder')}
        />
        {errors.companyName !== undefined ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{errors.companyName}</Text>
        ) : null}

        <Field
          label={t('agencySignup.cuiLabel')}
          value={cui}
          onChangeText={(value) => {
            setCui(value);
            setErrors((current) => ({ ...current, cui: undefined }));
          }}
          placeholder={t('agencySignup.cuiPlaceholder')}
          hint={t('agencySignup.cuiHint')}
        />
        {errors.cui !== undefined ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{errors.cui}</Text>
        ) : null}

        <Field
          label={t('agencySignup.registrationNumberLabel')}
          value={registrationNumber}
          onChangeText={setRegistrationNumber}
          placeholder={t('agencySignup.registrationNumberPlaceholder')}
        />

        <Field
          label={t('agencySignup.addressLabel')}
          value={address}
          onChangeText={setAddress}
          placeholder={t('agencySignup.addressPlaceholder')}
        />

        <Text style={[styles.sectionLabel, { color: tokens.textSecondary }]}>
          {t('agencySignup.contactSection')}
        </Text>
        <Field
          label={t('auth.emailLabel')}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          placeholder={t('auth.emailPlaceholder')}
          keyboardType="email-address"
        />
        {errors.email !== undefined ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{errors.email}</Text>
        ) : null}

        <Field
          label={t('auth.passwordLabel')}
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          placeholder={t('auth.passwordPlaceholderSignUp')}
          secure
        />
        {errors.password !== undefined ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{errors.password}</Text>
        ) : null}

        {notice !== null ? (
          <Text style={[styles.notice, { color: tokens.accentPrimary }]}>{notice}</Text>
        ) : null}

        {notice === null ? (
          <Button
            label={busy ? t('agencySignup.creatingButton') : t('agencySignup.createButton')}
            onPress={() => void submit()}
            disabled={busy}
            style={styles.submit}
          />
        ) : (
          <TouchableOpacity
            onPress={() => router.replace('/auth')}
            activeOpacity={0.7}
            accessibilityRole="button"
            style={styles.goToSignIn}
          >
            <Text style={[styles.goToSignInText, { color: tokens.accentPrimary }]}>
              {t('agencySignup.goToSignIn')}
            </Text>
          </TouchableOpacity>
        )}
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: spacing.md,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  notice: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 4,
  },
  submit: {
    marginTop: spacing.md,
  },
  goToSignIn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  goToSignInText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
