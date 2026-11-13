-- The organizer's own cover photo, shown on the event page instead of the drawn
-- cover. The file is in event-photos at {eventId}/cover/{uuid}.jpg (a new name per
-- upload, since the app caches by path); the bucket's policies already cover it.
alter table public.events add column if not exists cover_photo_path text;
