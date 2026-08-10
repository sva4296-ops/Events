import { router } from 'expo-router';
import { useState } from 'react';
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
import { brand, fonts } from '@/utils/guestTheme';

type Mode = 'sign-in' | 'sign-up';

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Maps Supabase's error strings onto the field they belong under. */
function mapAuthError(message: string): FieldErrors {
  const text = message.toLowerCase();

  if (text.includes('already registered') || text.includes('already been registered')) {
    return { email: 'An account with this email already exists.' };
  }
  if (text.includes('invalid login credentials')) {
    return { password: 'That email and password combination is incorrect.' };
  }
  if (text.includes('email not confirmed')) {
    return { email: 'Confirm your email address first — check your inbox.' };
  }
  if (text.includes('password')) {
    return { password: message };
  }
  if (text.includes('email')) {
    return { email: message };
  }
  return { password: message };
}

export default function AuthScreen() {
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
      next.email = 'Enter a valid email address.';
    }
    if (password.length === 0) {
      next.password = 'Enter your password.';
    } else if (isSignUp && password.length < 6) {
      next.password = 'Use at least 6 characters.';
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
      setNotice('Account created. Confirm your email, then sign in.');
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

        <Text style={styles.headline}>{isSignUp ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={styles.sub}>
          {isSignUp
            ? 'One account for every event you host or attend.'
            : 'Sign in to pick up where you left off.'}
        </Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, errors.email !== undefined && styles.inputError]}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
              placeholder="maria@example.com"
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
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password !== undefined && styles.inputError]}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              placeholder={isSignUp ? 'At least 6 characters' : 'Your password'}
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
                  ? 'Creating account…'
                  : 'Signing in…'
                : isSignUp
                  ? 'Create account'
                  : 'Sign in'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={switchMode} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.toggle}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={styles.toggleAccent}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
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
