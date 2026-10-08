import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { showDialog } from '@/components/ActionSheet';
import { useEventDraft } from '@/hooks/useEventDraft';

/**
 * Exits the whole create-event flow back to Home, confirming first if the
 * organizer has already entered something.
 */
export function useCancelCreate(): () => void {
  const { t } = useTranslation();
  const { draft, resetDraft } = useEventDraft();

  const dirty =
    draft.type !== null ||
    [draft.name, draft.date, draft.location, draft.welcomeMessage].some(
      (value) => value.trim().length > 0,
    );

  return () => {
    const exit = () => {
      resetDraft();
      router.navigate('/');
    };

    if (!dirty) {
      exit();
      return;
    }

    showDialog({
      title: t('createWizard.discardTitle'),
      message: t('createWizard.discardBody'),
      buttons: [
        { label: t('createWizard.keepEditing'), style: 'cancel' },
        { label: t('createWizard.discard'), style: 'destructive', onPress: exit },
      ],
    });
  };
}
