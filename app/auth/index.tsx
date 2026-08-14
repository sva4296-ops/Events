import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/BrandHeader';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { mapAuthError, type AuthFieldErrors } from '@/utils/authErrors';
import { fonts } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';

type Mode = 'sign-in' | 'sign-up';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();
  const { tokens } = useTheme();
  // Set when arriving from /auth/choose-type's "individual" option, so that
  // choice screen can land directly on the sign-up fields instead of sign-in.
  const params = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<Mode>(params.mode === 'sign-up' ? 'sign-up' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'sign-up';

  const switchMode = () => {
    setMode(isSignUp ? 'sign-in' : 'sign-up');
    setErrors({});
    setNotice(null);
  };

  const validate = (): boolean => {
    const next: AuthFieldErrors = {};

    if (!EMAIL_PATTERN.test(email.trim())) {
      next.email = t('auth.errors.invalidEmail');
    }
    if (password.length === 0) {
      next.password = t('auth.errors.emptyPassword');
    } else if (isSignUp && password.length < 6) {
      next.password = t('auth.errors.passwordTooShort');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    setNotice(null);
    if (!validate()) return;

    setBusy(true);
    const error = isSignUp
      ? await signUp(email.trim(), password)
      : await signIn(email.trim(), password);
    setBusy(false);

    if (error !== null) {
      setErrors(mapAuthError(error));
      return;
    }

    if (isSignUp) {
      // Email confirmation is on for this project, so there is no session yet.
      setNotice(t('auth.accountCreatedNotice'));
      setMode('sign-in');
      setPassword('');
      return;
    }

    router.replace('/');
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScreenBackground />
      <ScrollView
        style={styles.page}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <BrandHeader size="sm" />
        </View>

        <Text style={[styles.headline, { color: tokens.textPrimary }]}>
          {isSignUp ? t('auth.createAccountHeadline') : t('auth.welcomeBackHeadline')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>
          {isSignUp ? t('auth.createAccountSub') : t('auth.signInSub')}
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: tokens.textPrimary }]}>{t('auth.emailLabel')}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: tokens.surface,
                  borderColor: errors.email !== undefined ? tokens.destructive : tokens.surfaceBorder ?? '#EAE4F0',
                  color: tokens.textPrimary,
                },
              ]}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={tokens.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Email"
            />
            {errors.email !== undefined ? (
              <Text style={[styles.error, { color: tokens.destructive }]}>{errors.email}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: tokens.textPrimary }]}>{t('auth.passwordLabel')}</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: tokens.surface,
                  borderColor: errors.password !== undefined ? tokens.destructive : tokens.surfaceBorder ?? '#EAE4F0',
                  color: tokens.textPrimary,
                },
              ]}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              placeholder={isSignUp ? t('auth.passwordPlaceholderSignUp') : t('auth.passwordPlaceholderSignIn')}
              placeholderTextColor={tokens.textSecondary}
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="Password"
            />
            {errors.password !== undefined ? (
              <Text style={[styles.error, { color: tokens.destructive }]}>{errors.password}</Text>
            ) : null}
          </View>

          {!isSignUp ? (
            <TouchableOpacity
              onPress={() => router.push('/forgot-password')}
              activeOpacity={0.7}
              accessibilityRole="button"
              style={styles.forgotPassword}
            >
              <Text style={[styles.forgotPasswordText, { color: tokens.accentPrimary }]}>
                {t('auth.forgotPassword')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {notice !== null ? (
            <Text style={[styles.notice, { color: tokens.accentPrimary }]}>{notice}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: tokens.accentPrimary }, busy && styles.buttonBusy]}
            onPress={() => void submit()}
            disabled={busy}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.buttonLabel}>
              {busy
                ? isSignUp
                  ? t('auth.creatingAccountButton')
                  : t('auth.signingInButton')
                : isSignUp
                  ? t('auth.createAccountButton')
                  : t('auth.signInButton')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              // sign-up → sign-in stays an in-place toggle, unchanged. Only
              // sign-in → sign-up now goes through the account-type choice
              // first — see app/auth/choose-type.tsx.
              if (isSignUp) {
                switchMode();
              } else {
                router.push('/auth/choose-type');
              }
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Text style={[styles.toggle, { color: tokens.textSecondary }]}>
              {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
              <Text style={[styles.toggleAccent, { color: tokens.accentPrimary }]}>
                {isSignUp ? t('auth.signInToggle') : t('auth.signUpToggle')}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
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
    // Transparent so ScreenBackground shows through.
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    gap: 8,
  },
  brand: {
    marginBottom: 28,
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    lineHeight: 40,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    marginTop: 28,
    gap: 18,
  },
  field: {
    gap: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderRadius: themeRadius.md,
    borderWidth: 1,
    paddingHorizontal: 18,
    fontSize: 15,
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
  notice: {
    fontSize: 13,
    lineHeight: 19,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    minHeight: 54,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonBusy: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toggle: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 8,
  },
  toggleAccent: {
    fontWeight: '700',
  },
});
