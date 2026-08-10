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

/** Short clock label for chat bubbles, e.g. "14:32". */
export function timeOfDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
