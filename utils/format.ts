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

/** "1 august 2027" in the app's language — the compact date Warm Story 2.0 cards use. */
export function formatShortDate(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return i18n.t('common.dateToBeAnnounced');

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;

  return parsed.toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Short date plus place, e.g. "12 iunie 2027 · Salon Aurora". */
export function eventShortSubtitle(event: AppEvent): string {
  const place = event.location.trim();
  const date = formatShortDate(event.date);
  return place.length > 0 ? `${date} · ${place}` : date;
}

/**
 * Whole days from today (local midnight) to the event date. Null when the
 * organizer-typed date doesn't parse.
 */
export function daysUntilEvent(value: string): number | null {
  const parsed = new Date(value.trim());
  if (value.trim().length === 0 || Number.isNaN(parsed.getTime())) return null;

  // A bare `YYYY-MM-DD` parses as UTC midnight; anything else parses as local time.
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  const eventDay = isoDay
    ? new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
    : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);
}
