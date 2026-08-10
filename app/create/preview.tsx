import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { InviteCard } from '@/components/InviteCard';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { colors, spacing } from '@/utils/theme';
import { reportSupabaseError } from '@/utils/reportError';

export default function PreviewScreen() {
  const { draft } = useEventDraft();
  const { createEvent } = useEvents();
  const cancel = useCancelCreate();

  const handleGenerate = async () => {
    try {
      const event = await createEvent(draft);
      router.push({ pathname: '/create/share', params: { id: event.id } });
    } catch (error) {
      reportSupabaseError(error);
    }
  };

  return (
    <Screen
      footer={<Button label="Generate invite" onPress={() => void handleGenerate()} />}
      contentStyle={styles.content}
    >
      <Header
        title="How it will look"
        subtitle="This is what your guests will see when they open the invitation."
        showBack
        onClose={cancel}
        step={3}
        totalSteps={4}
      />

      <InviteCard event={draft} />

      <Text style={styles.note}>Need a change? Go back and edit the details.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  note: {
    fontSize: 13,
    color: colors.faint,
    textAlign: 'center',
  },
});
