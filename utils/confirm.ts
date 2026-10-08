import { showDialog } from '@/components/ActionSheet';
import i18n from '@/utils/i18n';

/** Standard destructive confirmation used before structural deletes (the app's own popup). */
export function confirmDelete(title: string, message: string, onConfirm: () => void): void {
  showDialog({
    title,
    message,
    buttons: [
      { label: i18n.t('common.cancel'), style: 'cancel' },
      { label: i18n.t('common.delete'), style: 'destructive', onPress: onConfirm },
    ],
  });
}
