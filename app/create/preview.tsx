import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Header } from '@/components/Header';
import { InviteCard } from '@/components/InviteCard';
import { Screen } from '@/components/Screen';
import { useCancelCreate } from '@/hooks/useCancelCreate';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { reportSupabaseError } from '@/utils/reportError';

export default function PreviewScreen() {
  const { t } = useTranslation();
  const { draft } = useEventDraft();
  const { createEvent } = useEvents();
  const cancel = useCancelCreate();
  const { tokens } = useTheme();

  const handleGenerate = async () => {
    try {
      const event = await createEvent(draft);
      // Pricing comes before the share step and before the event's Acasă tab
      // is ever reached — replace, not push, so pricing's own forward-only
      // navigation (see app/pricing/[id].tsx) ends up with the same final
      // stack shape this screen produced before (details → preview → share),
      // rather than leaving this submit screen behind pricing where a literal
      // back tap could resubmit and create a second event.
      router.replace({ pathname: '/pricing/[id]', params: { id: event.id, context: 'create' } });
    } catch (error) {
      reportSupabaseError(error);
    }
  };

  return (
    <Screen
      footer={<Button label={t('createWizard.previewButton')} onPress={() => void handleGenerate()} />}
      contentStyle={styles.content}
    >
      <Header
        title={t('createWizard.previewTitle')}
        subtitle={t('createWizard.previewSubtitle')}
        showBack
        onClose={cancel}
        step={3}
        totalSteps={4}
      />

      <InviteCard event={draft} />

      <Text style={[styles.note, { color: tokens.textSecondary }]}>{t('createWizard.previewNote')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
  },
  note: {
    fontSize: 13,
    textAlign: 'center',
  },
});
