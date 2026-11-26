import { showDialog } from '@/components/ActionSheet';
import i18n from '@/utils/i18n';
import { captureError } from '@/utils/sentry';

/** Message of an Error or a PostgrestError-shaped object (which isn't an Error instance). */
export function supabaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

/** Shared failure surface for fire-and-forget Supabase writes. */
export function reportSupabaseError(error: unknown): void {
  captureError(error);
  const message = error instanceof Error ? error.message : i18n.t('common.tryAgain');
  showDialog({ title: i18n.t('common.somethingWentWrong'), message });
}
