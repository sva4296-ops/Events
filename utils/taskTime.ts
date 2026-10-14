import type { TFunction } from 'i18next';

import { toTimeString } from '@/utils/dateInput';

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Azi, 12:00" / "Mâine, 09:30" / "vin. 17 oct., 18:00" for a checklist due time. */
export function formatTaskWhen(iso: string, t: TFunction, language: string): string {
  const date = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const day = sameDay(date, today)
    ? t('checklist.today')
    : sameDay(date, tomorrow)
      ? t('checklist.tomorrow')
      : date.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${toTimeString(date)}`;
}

/** Reminder choices, in minutes before the due time. */
export const REMINDER_OFFSETS = [0, 15, 30, 60, 120, 1440] as const;
