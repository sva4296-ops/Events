import { router } from 'expo-router';
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
import i18n from '@/utils/i18n';
import { brand, fonts } from '@/utils/guestTheme';

type Mode = 'sign-in' | 'sign-up';

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Maps Supabase's error strings onto the field they belong under. Module-scope,
 * not a component, so this uses the i18next singleton's `t` directly — same
 * reasoning as utils/format.ts's formatEventDate.
 */
function mapAuthError(message: string): FieldErrors {
  const text = message.toLowerCase();

  if (text.includes('already registered') || text.includes('already been registered')) {
    return { email: i18n.t('auth.errors.alreadyRegistered') };
  }
  if (text.includes('invalid login credentials')) {
    return { password: i18n.t('auth.errors.invalidCredentials') };
  }
  if (text.includes('email not confirmed')) {
    return { email: i18n.t('auth.errors.emailNotConfirmed') };
  }
  // Below this point the message is whatever Supabase returned, in whichever
  // language it returned it in — there's no translation table for arbitrary
  // server error text, so it passes through as-is.
  if (text.includes('password')) {
    return { password: message };
  }
  if (text.includes('email')) {
    return { email: message };
  }
  return { password: message };
}

export default function AuthScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'sign-up';

  const switchMode = () => {
    setMode(isSignUp ? 'sign-in' : 'sign-up');
    setErrors({});
    setNotice(null);
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

        <Text style={styles.headline}>
          {isSignUp ? t('auth.createAccountHeadline') : t('auth.welcomeBackHeadline')}
        </Text>
        <Text style={styles.sub}>
          {isSignUp ? t('auth.createAccountSub') : t('auth.signInSub')}
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.emailLabel')}</Text>
            <TextInput
              style={[styles.input, errors.email !== undefined && styles.inputError]}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={brand.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Email"
            />
            {errors.email !== undefined ? (
              <Text style={styles.error}>{errors.email}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
            <TextInput
              style={[styles.input, errors.password !== undefined && styles.inputError]}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              placeholder={isSignUp ? t('auth.passwordPlaceholderSignUp') : t('auth.passwordPlaceholderSignIn')}
              placeholderTextColor={brand.muted}
              secureTextEntry
              autoCapitalize="none"
              accessibilityLabel="Password"
            />
            {errors.password !== undefined ? (
              <Text style={styles.error}>{errors.password}</Text>
            ) : null}
          </View>

          {notice !== null ? <Text style={styles.notice}>{notice}</Text> : null}

          <TouchableOpacity
            style={[styles.button, busy && styles.buttonBusy]}
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

          <TouchableOpacity onPress={switchMode} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.toggle}>
              {isSignUp ? t('auth.alreadyHaveAccount') : t('auth.dontHaveAccount')}
              <Text style={styles.toggleAccent}>
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
    color: brand.navy,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: brand.muted,
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
    color: brand.navy,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: brand.lavender,
    paddingHorizontal: 18,
    fontSize: 15,
    color: brand.navy,
  },
  inputError: {
    borderColor: '#D9534F',
  },
  error: {
    fontSize: 12,
    lineHeight: 17,
    color: '#D9534F',
    paddingHorizontal: 4,
  },
  notice: {
    fontSize: 13,
    lineHeight: 19,
    color: brand.purple,
  },
  button: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: brand.purple,
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
    color: brand.muted,
    textAlign: 'center',
    paddingVertical: 8,
  },
  toggleAccent: {
    color: brand.purple,
    fontWeight: '700',
  },
});
