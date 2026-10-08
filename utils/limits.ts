import { daysUntilEvent } from '@/utils/format';

/** Album: max photos a guest can upload per event. Organizers have no limit.
 * Enforced server-side by 20261002000005_guest_photo_limit.sql; keep in sync. */
export const GUEST_PHOTO_LIMIT = 20;

/** Album uploads close once this many full days have passed since the event
 * (event on the 5th -> closed from the 9th). Enforced server-side by
 * 20261008000005_close_photo_uploads.sql; keep in sync. */
export const PHOTO_UPLOAD_DAYS_AFTER = 3;

/** True when the event had a date and more than PHOTO_UPLOAD_DAYS_AFTER days have passed. */
export function isPhotoUploadClosed(eventDate: string): boolean {
  const days = daysUntilEvent(eventDate);
  return days !== null && days < -PHOTO_UPLOAD_DAYS_AFTER;
}
