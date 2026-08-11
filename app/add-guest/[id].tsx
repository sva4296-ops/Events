import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { checkGuestEmailInvited } from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { colors, spacing } from '@/utils/theme';
import { reportSupabaseError } from '@/utils/reportError';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddGuestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner, addGuest } = useEvents();
  const { user } = useAuth();
  const event = getEvent(id);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (event === undefined || !isOwner(event)) {
    return (
      <Screen>
        <Header title="Not available" subtitle="Only the organizer can invite guests." showBack />
      </Screen>
    );
  }

  const submit = async () => {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (user?.email != null && trimmedEmail === user.email.toLowerCase()) {
      setError("You can't invite yourself — you're already the organizer.");
      return;
    }

    setBusy(true);
    try {
      const alreadyInvited = await checkGuestEmailInvited(event.id, trimmedEmail);
      if (alreadyInvited) {
        setError('This person is already invited.');
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label={busy ? 'Sending…' : 'Send invite'}
            disabled={email.trim().length === 0 || busy}
            onPress={() => void submit()}
          />
        }
      >
        <Header
          title="Invite a guest"
          subtitle="They'll show up under My invitations once they sign in with this email."
          showBack
        />

        <Field
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          placeholder="maria@example.com"
          keyboardType="email-address"
        />
        <Field
          label="Name (optional)"
          value={name}
          onChangeText={setName}
          placeholder="Maria Popescu"
        />

        {error !== null ? <Text style={styles.error}>{error}</Text> : null}
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
    color: colors.danger,
    paddingHorizontal: spacing.xs,
  },
});
