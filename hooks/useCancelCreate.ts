import { router } from 'expo-router';
import { Alert } from 'react-native';

import { useEventDraft } from '@/hooks/useEventDraft';

/**
 * Exits the whole create-event flow back to Home, confirming first if the
 * organizer has already entered something.
 */
export function useCancelCreate(): () => void {
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

    Alert.alert('Discard this event?', 'Everything you entered will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: exit },
    ]);
  };
}
