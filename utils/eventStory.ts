import type { AppEvent } from '@/types/event';
import type { EventContent, Moment, Photo, ScheduleItem } from '@/types/guest';

/**
 * The post-event story, built from what the event already has: no chat (it's
 * deleted after the event) and no AI, just templates per event type
 * (story.* in the locale files). Slides with nothing to show are left out.
 */
export type StorySlide =
  | { kind: 'cover' }
  | { kind: 'stats'; guests: number; photos: number; moments: number }
  | { kind: 'journey'; items: JourneyItem[] }
  | { kind: 'day'; schedule: ScheduleItem[] }
  | { kind: 'photos'; urls: string[]; total: number }
  | { kind: 'people'; names: string[]; uploaders: number }
  | { kind: 'thanks' }
  | { kind: 'end' };

export interface JourneyItem {
  id: string;
  title: string;
  photoUrl: string | null;
  /** Whole days before the event (0 = on the day). */
  daysBefore: number;
}

const MAX_JOURNEY = 4;
const MAX_SCHEDULE = 6;
const MAX_PHOTOS = 6;
const MAX_PEOPLE = 5;

/** `YYYY-MM-DD` (or anything Date can read) -> local midnight ms, or null. */
function eventDayMs(value: string): number | null {
  const trimmed = value.trim();
  const parsed = new Date(trimmed);
  if (trimmed.length === 0 || Number.isNaN(parsed.getTime())) return null;
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const day = isoDay
    ? new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate())
    : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return day.getTime();
}

function daysBefore(eventMs: number, iso: string): number | null {
  const created = new Date(iso);
  if (Number.isNaN(created.getTime())) return null;
  const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
  return Math.round((eventMs - createdDay) / 86_400_000);
}

function journeyItems(moments: readonly Moment[], eventMs: number | null): JourneyItem[] {
  if (eventMs === null) return [];
  const before = moments
    .map((moment) => ({ moment, days: daysBefore(eventMs, moment.created_at) }))
    .filter((entry): entry is { moment: Moment; days: number } => entry.days !== null && entry.days >= 0)
    // Oldest first: the story reads forward in time.
    .sort((a, b) => b.days - a.days);
  // Spread the picks over the whole run-up instead of the first few.
  const picked =
    before.length <= MAX_JOURNEY
      ? before
      : Array.from({ length: MAX_JOURNEY }, (_, i) => before[Math.round((i * (before.length - 1)) / (MAX_JOURNEY - 1))]!);
  return picked.map(({ moment, days }) => ({
    id: moment.id,
    title: moment.title,
    photoUrl: moment.photo_url.length > 0 ? moment.photo_url : null,
    daysBefore: days,
  }));
}

function photoPicks(photos: readonly Photo[]): string[] {
  const urls = photos.map((photo) => photo.full_url ?? photo.thumb_url ?? photo.url).filter((url): url is string => url !== null);
  if (urls.length <= MAX_PHOTOS) return urls;
  // Evenly spaced through the album, so it isn't just the last few uploads.
  return Array.from({ length: MAX_PHOTOS }, (_, i) => urls[Math.floor((i * urls.length) / MAX_PHOTOS)]!);
}

function topUploaders(photos: readonly Photo[]): { names: string[]; uploaders: number } {
  const counts = new Map<string, { name: string | null; count: number }>();
  for (const photo of photos) {
    const entry = counts.get(photo.uploaded_by) ?? { name: photo.uploaded_by_label, count: 0 };
    entry.count += 1;
    counts.set(photo.uploaded_by, entry);
  }
  const names = [...counts.values()]
    .filter((entry): entry is { name: string; count: number } => entry.name !== null && entry.name.trim().length > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_PEOPLE)
    .map((entry) => entry.name.trim());
  return { names, uploaders: counts.size };
}

export function buildEventStory(event: AppEvent, content: EventContent, confirmedGuests: number): StorySlide[] {
  const eventMs = eventDayMs(event.date);
  const slides: StorySlide[] = [{ kind: 'cover' }];

  const photosWithFile = content.photos.filter((photo) => (photo.full_url ?? photo.thumb_url ?? photo.url) !== null);
  if (confirmedGuests > 0 || photosWithFile.length > 0 || content.moments.length > 0) {
    slides.push({
      kind: 'stats',
      guests: confirmedGuests,
      photos: photosWithFile.length,
      moments: content.moments.length,
    });
  }

  const journey = journeyItems(content.moments, eventMs);
  if (journey.length > 0) slides.push({ kind: 'journey', items: journey });

  if (content.schedule.length > 0) slides.push({ kind: 'day', schedule: content.schedule.slice(0, MAX_SCHEDULE) });

  const urls = photoPicks(photosWithFile);
  if (urls.length > 0) slides.push({ kind: 'photos', urls, total: photosWithFile.length });

  const people = topUploaders(photosWithFile);
  if (people.names.length > 0) slides.push({ kind: 'people', names: people.names, uploaders: people.uploaders });

  slides.push({ kind: 'thanks' }, { kind: 'end' });
  return slides;
}

/** The story exists once the event is over and its album is ready (~72h after). */
export function isStoryReady(event: AppEvent | undefined): boolean {
  return event !== undefined && event.albumStatus === 'ready';
}
