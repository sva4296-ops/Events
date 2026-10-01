import type { AppEvent } from '@/types/event';
import { daysUntilEvent } from '@/utils/format';

/** 0 = today or upcoming, 1 = already happened, 2 = no (parseable) date. */
function bucket(days: number | null): number {
  if (days === null) return 2;
  return days >= 0 ? 0 : 1;
}

/**
 * Home list order: upcoming events first, soonest at the top (calendar order);
 * then past events, most recent first; events without a date last.
 */
export function compareEventsByDate(a: AppEvent, b: AppEvent): number {
  const daysA = daysUntilEvent(a.date);
  const daysB = daysUntilEvent(b.date);
  const bucketA = bucket(daysA);
  const bucketB = bucket(daysB);
  if (bucketA !== bucketB) return bucketA - bucketB;
  if (daysA === null || daysB === null) return 0;
  return bucketA === 0 ? daysA - daysB : daysB - daysA;
}
