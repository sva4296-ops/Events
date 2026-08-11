import type { AppEvent, Guest } from '@/types/event';

export interface Invitation {
  event: AppEvent;
  guest: Guest;
}

/**
 * Events this account is a guest of. Owning an event and being a guest of it are
 * mutually exclusive, so owned events are always excluded — nothing may appear
 * under both "Your events" and "My invitations".
 */
export function myInvitations(
  events: readonly AppEvent[],
  isOwner: (event: AppEvent) => boolean,
): Invitation[] {
  const invitations: Invitation[] = [];

  for (const event of events) {
    if (isOwner(event)) continue;

    // RLS already limits a non-organizer's event.guests to just their own
    // row, so [0] is "my" row.
    const guest = event.guests[0];
    if (guest !== undefined) {
      invitations.push({ event, guest });
    }
  }

  return invitations;
}
