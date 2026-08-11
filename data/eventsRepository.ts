import { supabase } from '@/data/supabaseClient';
import type { AppEvent, EventDraft, Guest, RsvpStatus } from '@/types/event';
import type { EventGuestRow, EventWithGuestsRow } from '@/types/supabase';

/**
 * Supabase-backed events + guests. hooks/useEvents.tsx is the only caller.
 */

const SELECT_WITH_GUESTS = '*, event_guests(*)';

function mapGuestRow(row: EventGuestRow): Guest {
  return {
    id: row.id,
    name: row.guest_name ?? row.guest_email ?? 'Guest',
    status: row.rsvp_status,
    respondedAt: row.responded_at,
    dietaryPreferences: row.dietary_preferences,
  };
}

function mapEventRow(row: EventWithGuestsRow): AppEvent {
  return {
    id: row.id,
    owner_id: row.organizer_id,
    type: row.type,
    name: row.name,
    date: row.event_date ?? '',
    location: row.location ?? '',
    welcomeMessage: row.welcome_message ?? '',
    createdAt: row.created_at,
    guests: row.event_guests.map(mapGuestRow),
  };
}

/**
 * RLS-scoped to events you organize or are already a guest of. A not-yet-guest
 * opening a fresh invite link won't find the event here or via fetchEventById —
 * see CLAUDE.md's note on the invite-preview limitation.
 */
export async function fetchEvents(): Promise<AppEvent[]> {
  const client = supabase;
  const { data, error } = await client
    .from('events')
    .select(SELECT_WITH_GUESTS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as EventWithGuestsRow[]).map(mapEventRow);
}

export async function fetchEventById(eventId: string): Promise<AppEvent | null> {
  const client = supabase;
  const { data, error } = await client
    .from('events')
    .select(SELECT_WITH_GUESTS)
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data === null ? null : mapEventRow(data as EventWithGuestsRow);
}

export async function insertEvent(draft: EventDraft, organizerId: string): Promise<AppEvent> {
  const client = supabase;
  const { data, error } = await client
    .from('events')
    .insert({
      organizer_id: organizerId,
      type: draft.type ?? 'other',
      name: draft.name.trim(),
      event_date: draft.date.trim().length > 0 ? draft.date.trim() : null,
      location: draft.location.trim(),
      welcome_message: draft.welcomeMessage.trim(),
    })
    .select(SELECT_WITH_GUESTS)
    .single();
  if (error) throw error;
  return mapEventRow(data as EventWithGuestsRow);
}

export async function updateEventRow(
  eventId: string,
  patch: Partial<Omit<AppEvent, 'id' | 'owner_id' | 'guests' | 'createdAt'>>,
): Promise<void> {
  const client = supabase;
  const columns: Record<string, unknown> = {};
  if (patch.name !== undefined) columns.name = patch.name;
  if (patch.date !== undefined) {
    columns.event_date = patch.date.trim().length > 0 ? patch.date.trim() : null;
  }
  if (patch.location !== undefined) columns.location = patch.location;
  if (patch.welcomeMessage !== undefined) columns.welcome_message = patch.welcomeMessage;
  if (patch.type !== undefined) columns.type = patch.type;
  if (Object.keys(columns).length === 0) return;

  const { error } = await client.from('events').update(columns).eq('id', eventId);
  if (error) throw error;
}

/**
 * Insert-or-update against the (event_id, guest_user_id) index by hand, rather
 * than .upsert(): that index is partial (`where guest_user_id is not null`), and
 * PostgREST's upsert emits a bare ON CONFLICT (event_id, guest_user_id) that
 * can't match a partial index as its conflict target.
 */
export async function respondToInviteRow(
  eventId: string,
  guestUserId: string,
  guestName: string,
  status: Exclude<RsvpStatus, 'pending'>,
): Promise<void> {
  const client = supabase;
  const { data: existing, error: selectError } = await client
    .from('event_guests')
    .select('id')
    .eq('event_id', eventId)
    .eq('guest_user_id', guestUserId)
    .maybeSingle();
  if (selectError) throw selectError;

  const respondedAt = new Date().toISOString();

  if (existing === null) {
    const { error } = await client.from('event_guests').insert({
      event_id: eventId,
      guest_user_id: guestUserId,
      guest_name: guestName,
      rsvp_status: status,
      responded_at: respondedAt,
    });
    if (error) throw error;
    return;
  }

  const { error } = await client
    .from('event_guests')
    .update({ rsvp_status: status, responded_at: respondedAt, guest_name: guestName })
    .eq('id', existing.id);
  if (error) throw error;
}

export async function removeGuestRow(guestId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('event_guests').delete().eq('id', guestId);
  if (error) throw error;
}

/** Case-insensitive exact match — used before insertGuestInvite for a friendly
 * "already invited" message instead of surfacing the unique-index violation. */
export async function checkGuestEmailInvited(eventId: string, email: string): Promise<boolean> {
  const client = supabase;
  const { data, error } = await client
    .from('event_guests')
    .select('id')
    .eq('event_id', eventId)
    .ilike('guest_email', email)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * guest_user_id is left unset — the on_event_guest_insert trigger (migration
 * 20260810000003) fills it in immediately if the email already has an account.
 */
export async function insertGuestInvite(eventId: string, email: string, name: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('event_guests').insert({
    event_id: eventId,
    guest_email: email,
    guest_name: name.length > 0 ? name : null,
    rsvp_status: 'pending',
  });
  if (error) throw error;
}

/** A guest's own preference on their own row — covered by the existing "update
 * own rsvp or as organizer" policy, no new RLS needed. */
export async function updateDietaryPreferencesRow(
  eventId: string,
  guestUserId: string,
  preferences: string[],
): Promise<void> {
  const client = supabase;
  const { error } = await client
    .from('event_guests')
    .update({ dietary_preferences: preferences })
    .eq('event_id', eventId)
    .eq('guest_user_id', guestUserId);
  if (error) throw error;
}
