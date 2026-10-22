import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { VenueSetupForm, isVenueSetupValid, newZone, suggestedTimes } from '@/components/venue/VenueSetupForm';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { EVENT_TYPE_COLORS } from '@/utils/eventCovers';
import { wizardStep } from '@/utils/spontaneous';

/** Venue events only: zones with capacity, arrival slots, price line. */
export default function VenueSetupStep() {
  const { t } = useTranslation();
  const { draft, updateDraft } = useEventDraft();
  const cancel = useCancelCreate();
  const step = wizardStep('venue', 'venue');

  // First visit: one zone to fill in and the start time as the first slot.
  useEffect(() => {
    if (draft.zones.length === 0) {
      updateDraft({
        zones: [newZone(t('venue.setup.defaultZone'))],
        bookingTimes: draft.bookingTimes.length > 0 ? draft.bookingTimes : suggestedTimes(draft.startTime).slice(0, 1),
      });
    }
  }, [draft.zones.length, draft.bookingTimes, draft.startTime, updateDraft, t]);

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        footer={
          <Button
            label={t('createWizard.continue')}
            disabled={!isVenueSetupValid(draft)}
            onPress={() => router.push('/create/preview')}
          />
        }
      >
        <Header
          title={t('venue.wizard.setupTitle')}
          subtitle={t('venue.wizard.setupSubtitle')}
          showBack
          onClose={cancel}
          flowTitle={t('createWizard.flowTitle')}
          stepLabel={t('createWizard.stepLabel', { ...step, name: t('venue.wizard.stepSetup') })}
          step={step.step}
          totalSteps={step.total}
          progressColors={EVENT_TYPE_COLORS.venue.gradient}
        />
        <VenueSetupForm value={draft} onChange={updateDraft} startTime={draft.startTime} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
