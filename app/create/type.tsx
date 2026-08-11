import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();

  return (
    <Screen
      footer={
        <Button
          label={t('createWizard.continue')}
          disabled={draft.type === null}
          onPress={() => router.push('/create/details')}
        />
      }
    >
      <Header
        title={t('createWizard.typeTitle')}
        subtitle={t('createWizard.typeSubtitle')}
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
