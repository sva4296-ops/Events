import { showDialog } from '@/components/ActionSheet';
import i18n from '@/utils/i18n';
import { captureError } from '@/utils/sentry';

/** Shared failure surface for fire-and-forget Supabase writes. */
export function reportSupabaseError(error: unknown): void {
  captureError(error);
  const message = error instanceof Error ? error.message : i18n.t('common.tryAgain');
  showDialog({ title: i18n.t('common.somethingWentWrong'), message });
}
