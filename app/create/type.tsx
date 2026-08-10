import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TypeTile } from '@/components/TypeTile';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { EVENT_TYPES } from '@/utils/eventTypes';
import { spacing } from '@/utils/theme';

export default function PickTypeScreen() {
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();

  return (
    <Screen
      footer={
        <Button
          label="Continue"
          disabled={draft.type === null}
          onPress={() => router.push('/create/details')}
        />
      }
    >
      <Header
        title="What are we celebrating?"
        subtitle="Pick the type of event — it sets the look of your invitation."
        showBack
        onClose={cancel}
        step={1}
        totalSteps={4}
      />

      <View style={styles.grid}>
        {EVENT_TYPES.map((type) => (
          <TypeTile
            key={type.id}
            type={type}
            selected={draft.type === type.id}
            onPress={() => updateDraft({ type: type.id })}
          />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
