import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { checkGuestEmailInvited, checkGuestPhoneInvited } from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_COUNTRY_CODE, toStoredPhone } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';
import { reportSupabaseError } from '@/utils/reportError';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type InviteMethod = 'email' | 'phone';

export default function AddGuestScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, addGuest, addGuestByPhone } = useEvents();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const event = getEvent(id);

  // One invite method per submission, not both at once — avoids the
  // ambiguity of a single row auto-linking against two different identifiers.
  const [method, setMethod] = useState<InviteMethod>('email');
  const [email, setEmail] = useState('');
  const [dialCode, setDialCode] = useState(DEFAULT_COUNTRY_CODE.dialCode);
  const [localNumber, setLocalNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (event === undefined || !isOwner(event)) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('addGuestForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  /** Returns true on a successful invite, false on a fixable inline error
   * (error state is already set in that case) — the caller uses this instead
   * of re-reading `error` state, which wouldn't reflect a just-set value in
   * the same tick. */
  const submitEmail = async (): Promise<boolean> => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t('auth.errors.invalidEmail'));
      return false;
    }
    if (user?.email != null && trimmedEmail === user.email.toLowerCase()) {
      setError(t('addGuestForm.selfInviteError'));
      return false;
    }

    const alreadyInvited = await checkGuestEmailInvited(event.id, trimmedEmail);
    if (alreadyInvited) {
      setError(t('addGuestForm.alreadyInvitedError'));
      return false;
    }

    await addGuest(event.id, trimmedEmail, name.trim());
    return true;
  };

  const submitPhone = async (): Promise<boolean> => {
    const digits = localNumber.replace(/\D/g, '');
    if (digits.length < 6) {
      setError(t('phoneAuth.errors.invalidPhone'));
      return false;
    }

    // toStoredPhone, not toE164 — this value is written to event_guests.guest_phone
    // and compared against auth.users.phone/public.users.phone by the auto-link
    // trigger, both of which Supabase stores without a leading `+`.
    const phone = toStoredPhone(dialCode, localNumber);
    if (user?.phone != null && phone === user.phone) {
      setError(t('addGuestForm.selfInviteError'));
      return false;
    }

    const alreadyInvited = await checkGuestPhoneInvited(event.id, phone);
    if (alreadyInvited) {
      setError(t('addGuestForm.alreadyInvitedError'));
      return false;
    }

    await addGuestByPhone(event.id, phone, name.trim());
    return true;
  };

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      const success = method === 'email' ? await submitEmail() : await submitPhone();
      if (success) router.back();
    } catch (err) {
      reportSupabaseError(err);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = method === 'email' ? email.trim().length > 0 : localNumber.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        footer={
          <Button
            label={busy ? t('addGuestForm.sending') : t('addGuestForm.sendInvite')}
            disabled={!canSubmit || busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header
          title={t('event.inviteGuest')}
          subtitle={method === 'email' ? t('addGuestForm.subtitle') : t('addGuestForm.subtitlePhone')}
          showBack
        />

        <View style={styles.methodToggle}>
          {(['email', 'phone'] as const).map((option) => {
            const active = method === option;
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.methodOption,
                  {
                    borderColor: active ? tokens.accentPrimary : tokens.surfaceBorder ?? 'rgba(0,0,0,0.1)',
                    backgroundColor: active ? tokens.accentPrimary : tokens.surface,
                  },
                ]}
                onPress={() => {
                  setMethod(option);
                  setError(null);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.methodOptionText, { color: active ? '#FFFFFF' : tokens.textPrimary }]}>
                  {option === 'email' ? t('addGuestForm.methodEmail') : t('addGuestForm.methodPhone')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {method === 'email' ? (
          <Field
            label={t('auth.emailLabel')}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
            }}
            placeholder={t('auth.emailPlaceholder')}
            keyboardType="email-address"
          />
        ) : (
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
        )}

        <Field
          label={t('addGuestForm.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('addGuestForm.namePlaceholder')}
        />

        {error !== null ? (
          <Text style={[styles.error, { color: tokens.destructive }]}>{error}</Text>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  methodToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodOption: {
    flex: 1,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  error: {
    fontSize: 13,
    paddingHorizontal: spacing.xs,
  },
});
