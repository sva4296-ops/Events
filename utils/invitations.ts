import type { AppEvent, Guest } from '@/types/event';
import { SELF_GUEST_ID } from '@/utils/guests';

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
  mode: 'supabase' | 'local',
): Invitation[] {
  const invitations: Invitation[] = [];

  for (const event of events) {
    if (isOwner(event)) continue;

    // In Supabase mode RLS already limits a non-organizer's event.guests to just
    // their own row, so [0] is "my" row; SELF_GUEST_ID is the local-mode-only
    // single-device sentinel and never matches a real Postgres row id.
    const guest =
      mode === 'supabase'
        ? event.guests[0]
        : event.guests.find((entry) => entry.id === SELF_GUEST_ID);
    if (guest !== undefined) {
      invitations.push({ event, guest });
    }
  }

  return invitations;
}
