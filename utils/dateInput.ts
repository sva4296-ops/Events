/** Local-midnight parse so "2026-09-12" round-trips without a timezone day-shift. */
export function parseIsoDate(value: string): Date {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    return new Date();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses "HH:MM" onto today's date so it can back a time-mode picker's value. */
export function parseTimeString(value: string): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  const base = new Date();
  if (match?.[1] === undefined || match[2] === undefined) {
    base.setHours(12, 0, 0, 0);
    return base;
  }
  base.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return base;
}

export function toTimeString(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
