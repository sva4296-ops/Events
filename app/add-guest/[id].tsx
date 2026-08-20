import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { PhoneField } from '@/components/PhoneField';
import { Screen } from '@/components/Screen';
import { checkGuestPhoneInvited } from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_COUNTRY_CODE, toStoredPhone } from '@/utils/countryCodes';
import { reportSupabaseError } from '@/utils/reportError';

/**
 * Phone-only now — this app's auth is phone-only end to end (see
 * hooks/useAuth.tsx), so an email invite could never actually be claimed by
 * signing in; inviting by phone is the only method that lines up with how
 * someone can actually verify and land in "My invitations." The email path
 * (a method toggle, an email Field, `checkGuestEmailInvited`/`addGuest`) is
 * removed from this screen; `data/eventsRepository.ts`'s email-invite
 * functions and the `event_guests.guest_email` column/auto-link trigger are
 * untouched — inert now that nothing calls them, not reverted, since ripping
 * out working schema/trigger logic wasn't asked for.
 */
export default function AddGuestScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, addGuestByPhone } = useEvents();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const event = getEvent(id);

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

  const submit = async () => {
    setError(null);

    const digits = localNumber.replace(/\D/g, '');
    if (digits.length < 6) {
      setError(t('phoneAuth.errors.invalidPhone'));
      return;
    }

    // toStoredPhone, not toE164 — this value is written to event_guests.guest_phone
    // and compared against auth.users.phone/public.users.phone by the auto-link
    // trigger, both of which Supabase stores without a leading `+`.
    const phone = toStoredPhone(dialCode, localNumber);
    if (user?.phone != null && phone === user.phone) {
      setError(t('addGuestForm.selfInviteError'));
      return;
    }

    setBusy(true);
    try {
      const alreadyInvited = await checkGuestPhoneInvited(event.id, phone);
      if (alreadyInvited) {
        setError(t('addGuestForm.alreadyInvitedError'));
        return;
      }

      await addGuestByPhone(event.id, phone, name.trim());
      router.back();
    } catch (err) {
      reportSupabaseError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        footer={
          <Button
            label={busy ? t('addGuestForm.sending') : t('addGuestForm.sendInvite')}
            disabled={localNumber.trim().length === 0 || busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header
          title={t('event.inviteGuest')}
          subtitle={t('addGuestForm.subtitlePhone')}
          showBack
        />

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
  error: {
    fontSize: 13,
    paddingHorizontal: 4,
  },
});
