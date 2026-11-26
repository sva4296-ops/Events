import type { AppEvent, CoOrganizer, Guest } from '@/types/event';

/**
 * The co-organizer event_members row behind a guest row, if any. Every
 * co-organizer also has a confirmed guest row (20261103000001), matched by
 * account first, then by phone (a member who hasn't signed in yet has no user_id).
 */
export function findCoOrganizerMember(event: AppEvent, guest: Guest): CoOrganizer | undefined {
  return event.coOrganizers.find(
    (member) =>
      member.role === 'co_organizer' &&
      ((member.userId !== null && member.userId === guest.userId) ||
        (member.phone !== null && member.phone === guest.phone)),
  );
}
