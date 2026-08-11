import type { AppEvent, Guest, RsvpCounts } from '@/types/event';
import i18n from '@/utils/i18n';

/**
 * Renders the organizer-typed date nicely when it parses, otherwise returns it
 * untouched so nothing the user typed is ever lost. Not a component/hook, so
 * this calls the i18next singleton's `t` directly rather than `useTranslation()`
 * — safe because callers are always re-rendered by a language change anyway
 * (they call `useTranslation()` themselves for their other chrome text).
 */
export function formatEventDate(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return i18n.t('common.dateToBeAnnounced');

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function countRsvps(guests: readonly Guest[]): RsvpCounts {
  const counts: RsvpCounts = { confirmed: 0, pending: 0, declined: 0, total: guests.length };
  for (const guest of guests) {
    counts[guest.status] += 1;
  }
  return counts;
}

export function eventSubtitle(event: AppEvent): string {
  const place = event.location.trim();
  const date = formatEventDate(event.date);
  return place.length > 0 ? `${date} · ${place}` : date;
}
