import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { showDialog } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TypeTile } from '@/components/TypeTile';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useAgency } from '@/hooks/useAgency';
import { useEventDraft } from '@/hooks/useEventDraft';
import { EVENT_TYPES } from '@/utils/eventTypes';
import { wizardStep } from '@/utils/spontaneous';

import { spacing } from '@/utils/theme';

export default function PickTypeScreen() {
  const { t } = useTranslation();
  const { draft, updateDraft, resetDraft } = useEventDraft();
  const cancel = useCancelCreate();
  // Venue events ("Local") need a business account (guard_venue_event_owner).
  // Everyone sees the tile; picking it without one offers to create it first.
  const { isAgencyOwner, hydrated: agencyHydrated } = useAgency();

  const next = () => {
    if (draft.type === 'venue' && agencyHydrated && !isAgencyOwner) {
      showDialog({
        title: t('venue.wizard.businessTitle'),
        message: t('venue.wizard.businessBody'),
        buttons: [
          { label: t('common.cancel'), style: 'cancel' },
          { label: t('venue.wizard.businessCta'), onPress: () => router.push('/agency-signup') },
        ],
      });
      return;
    }
    router.push(draft.type === 'spontaneous' ? '/create/template' : '/create/invite');
  };

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
          onPress={next}
        />
      }
    >
      <Header
        title={t('createWizard.typeTitle')}
        subtitle={t('createWizard.typeSubtitle')}
        showBack
        onClose={cancel}
        flowTitle={t('createWizard.flowTitle')}
        stepLabel={t('createWizard.stepLabel', { step: 1, total: wizardStep(draft.type, 'type').total, name: t('createWizard.stepType') })}
        step={1}
        totalSteps={wizardStep(draft.type, 'type').total}
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
    justifyContent: 'space-between',
    rowGap: spacing.lg,
  },
});
