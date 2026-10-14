import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TypeTile } from '@/components/TypeTile';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { EVENT_TYPES } from '@/utils/eventTypes';
import { EVENT_TYPE_COLORS } from '@/utils/eventCovers';

import { spacing } from '@/utils/theme';

export default function PickTypeScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft, resetDraft } = useEventDraft();
  const cancel = useCancelCreate();

  // This is the wizard's first screen: it unmounts only when the wizard is
  // left (back arrow, Android back, X, or the end of the flow). Start the next
  // event from an empty draft instead of the previous one's text.
  useEffect(() => resetDraft, [resetDraft]);

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
        flowTitle={t('createWizard.flowTitle')}
        stepLabel={t('createWizard.stepLabel', { step: 1, total: 5, name: t('createWizard.stepType') })}
        step={1}
        totalSteps={5}
          progressColors={draft.type !== null ? EVENT_TYPE_COLORS[draft.type].gradient : undefined}
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
