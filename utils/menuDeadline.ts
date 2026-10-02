/**
 * Menu-choice deadline, mirrored from public.menu_choice_closed()
 * (20261001000005_menu_options.sql): the LAST day a guest can change is
 * event_date minus choice_deadline_days, in Romanian time. The server
 * enforces it; this only drives the UI.
 */
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Max 14 on purpose: the ro "_other" copy reads "cu N zile" (no "de"), right for N < 20. */
export const MENU_DEADLINE_CHOICES = [1, 2, 3, 5, 7, 14] as const;

/** 'YYYY-MM-DD' of the last day to choose, or null when the event has no date. */
export function lastMenuChoiceDay(eventDate: string, days: number): string | null {
  const value = eventDate.trim();
  if (!ISO_DAY.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

function bucharestToday(): string {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}

export function isMenuChoiceClosed(eventDate: string, days: number): boolean {
  const last = lastMenuChoiceDay(eventDate, days);
  return last !== null && bucharestToday() > last;
}
