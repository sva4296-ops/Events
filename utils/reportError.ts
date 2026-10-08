import { showDialog } from '@/components/ActionSheet';
import i18n from '@/utils/i18n';

/** Shared failure surface for fire-and-forget Supabase writes. */
export function reportSupabaseError(error: unknown): void {
  const message = error instanceof Error ? error.message : i18n.t('common.tryAgain');
  showDialog({ title: i18n.t('common.somethingWentWrong'), message });
}
