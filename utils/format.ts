import type { AppEvent, Guest, RsvpCounts, RsvpStatus } from '@/types/event';

/**
 * Renders the organizer-typed date nicely when it parses, otherwise returns it
 * untouched so nothing the user typed is ever lost.
 */
export function formatEventDate(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Date to be announced';

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

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  declined: 'Declined',
};

export function eventSubtitle(event: AppEvent): string {
  const place = event.location.trim();
  const date = formatEventDate(event.date);
  return place.length > 0 ? `${date} · ${place}` : date;
}
