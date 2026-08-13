import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { checkGuestEmailInvited } from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { reportSupabaseError } from '@/utils/reportError';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddGuestScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, addGuest } = useEvents();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const event = getEvent(id);

  const [email, setEmail] = useState('');
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
    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }
    if (user?.email != null && trimmedEmail === user.email.toLowerCase()) {
      setError(t('addGuestForm.selfInviteError'));
      return;
    }

    setBusy(true);
    try {
      const alreadyInvited = await checkGuestEmailInvited(event.id, trimmedEmail);
      if (alreadyInvited) {
        setError(t('addGuestForm.alreadyInvitedError'));
        return;
      }

      await addGuest(event.id, trimmedEmail, name.trim());
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
            disabled={email.trim().length === 0 || busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header
          title={t('event.inviteGuest')}
          subtitle={t('addGuestForm.subtitle')}
          showBack
        />

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
    paddingHorizontal: spacing.xs,
  },
});
