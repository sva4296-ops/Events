import { showDialog } from '@/components/ActionSheet';
import { runWithBusy } from '@/components/BusyOverlay';
import i18n from '@/utils/i18n';

/**
 * Standard destructive confirmation used before structural deletes (the app's own popup).
 * When `onConfirm` returns a promise, a "Se șterge…" overlay covers the screen until it settles.
 */
export function confirmDelete(title: string, message: string, onConfirm: () => void | Promise<unknown>): void {
  showDialog({
    title,
    message,
    buttons: [
      { label: i18n.t('common.cancel'), style: 'cancel' },
      {
        label: i18n.t('common.delete'),
        style: 'destructive',
        onPress: () => {
          const result = onConfirm();
          if (result instanceof Promise) void runWithBusy(result, i18n.t('common.deleting')).catch(() => undefined);
        },
      },
    ],
  });
}
