import i18n from '@/utils/i18n';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Romanian relative timestamps, e.g. "acum 3 zile". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const diff = Math.max(0, Date.now() - then);

  if (diff < MINUTE) return 'chiar acum';
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return minutes === 1 ? 'acum un minut' : `acum ${minutes} de minute`;
  }
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return hours === 1 ? 'acum o oră' : `acum ${hours} ore`;
  }

  const days = Math.floor(diff / DAY);
  if (days === 1) return 'ieri';
  if (days < 20) return `acum ${days} zile`;
  return `acum ${days} de zile`;
}

/** Local calendar day of a timestamp, to tell chat messages' days apart. */
export function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Chat day separator: Today, Yesterday, otherwise the date (with the year if it isn't this one). */
export function chatDayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(iso) === dayKey(now.toISOString())) return i18n.t('chat.today');
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return i18n.t('chat.yesterday');
  return date.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

// toLocaleTimeString builds a formatter per call, slow on Android: one formatter, labels kept.
let clockFormat: Intl.DateTimeFormat | undefined;
const clockLabels = new Map<string, string>();

/** Short clock label for chat bubbles, e.g. "14:32". */
export function timeOfDay(iso: string): string {
  const cached = clockLabels.get(iso);
  if (cached !== undefined) return cached;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  clockFormat ??= new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  const label = clockFormat.format(date);
  clockLabels.set(iso, label);
  return label;
}
