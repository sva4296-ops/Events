import { supabase } from '@/data/supabaseClient';
import type { AppEvent, EventDraft, Guest, InvitePreview, RsvpStatus } from '@/types/event';
import type { EventGuestRow, EventWithGuestsRow, InvitePreviewRow } from '@/types/supabase';

/**
 * Supabase-backed events + guests. hooks/useEvents.tsx is the only caller.
 */

const SELECT_WITH_GUESTS = '*, event_guests(*)';

function mapGuestRow(row: EventGuestRow): Guest {
  return {
    id: row.id,
    name: row.guest_name ?? row.guest_email ?? row.guest_phone ?? 'Guest',
    status: row.rsvp_status,
    respondedAt: row.responded_at,
    dietaryPreferences: row.dietary_preferences,
    phone: row.guest_phone,
    whatsappSentAt: row.whatsapp_sent_at,
  };
}

function mapInvitePreviewRow(row: InvitePreviewRow): InvitePreview {
  return {
    eventId: row.event_id,
    type: row.type,
    name: row.name,
    date: row.event_date ?? '',
    location: row.location ?? '',
    welcomeMessage: row.welcome_message ?? '',
    guestId: row.guest_id,
    rsvpStatus: row.rsvp_status,
  };
}

function mapEventRow(row: EventWithGuestsRow): AppEvent {
  return {
    id: row.id,
    owner_id: row.organizer_id,
    agency_id: row.agency_id,
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

export async function insertEvent(
  draft: EventDraft,
  organizerId: string,
  agencyId: string | null,
): Promise<AppEvent> {
  const client = supabase;
  const { data, error } = await client
    .from('events')
    .insert({
      organizer_id: organizerId,
      agency_id: agencyId,
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
  patch: Partial<Omit<AppEvent, 'id' | 'owner_id' | 'agency_id' | 'guests' | 'createdAt'>>,
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

/** Phone equivalent of checkGuestEmailInvited — exact match, phone has no case. */
export async function checkGuestPhoneInvited(eventId: string, phone: string): Promise<boolean> {
  const client = supabase;
  const { data, error } = await client
    .from('event_guests')
    .select('id')
    .eq('event_id', eventId)
    .eq('guest_phone', phone)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Phone equivalent of insertGuestInvite — guest_user_id is left unset, the
 * same on_event_guest_insert trigger (extended by migration
 * 20260818000002) fills it in immediately if the phone already has an
 * account.
 */
export async function insertGuestInvitePhone(eventId: string, phone: string, name: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('event_guests').insert({
    event_id: eventId,
    guest_phone: phone,
    guest_name: name.length > 0 ? name : null,
    rsvp_status: 'pending',
  });
  if (error) throw error;
}

export interface BulkGuestEntry {
  phone: string;
  name: string;
}

/**
 * Batch version of insertGuestInvitePhone — app/bulk-add-guests/[id].tsx.
 * Calls the upsert_event_guests_batch RPC (20260822000001_bulk_guest_invites.sql)
 * rather than a plain client-side .upsert(): a naive upsert would overwrite
 * every column on conflict, resetting rsvp_status back to 'pending' for a
 * guest who already responded and nulling out an existing name whenever a
 * blank one is resubmitted. The RPC only ever refreshes guest_name (and only
 * when non-blank), same "add or update, never regress a response" contract
 * the single-invite path doesn't need to worry about since it only ever
 * inserts one row at a time.
 */
export async function upsertGuestInvitesBatch(eventId: string, guests: BulkGuestEntry[]): Promise<void> {
  if (guests.length === 0) return;
  const { error } = await supabase.rpc('upsert_event_guests_batch', {
    p_event_id: eventId,
    p_guests: guests.map((guest) => ({ phone: guest.phone, name: guest.name })),
  });
  if (error) throw error;
}

/** Marks a single guest row as messaged via WhatsApp — app/send-invites/[id].tsx.
 * "Sent" here means the app successfully opened the wa.me link, not that the
 * organizer actually pressed Send inside WhatsApp — there's no way to detect
 * that from outside the WhatsApp app itself. */
export async function markGuestWhatsAppSent(guestId: string): Promise<void> {
  const { error } = await supabase
    .from('event_guests')
    .update({ whatsapp_sent_at: new Date().toISOString() })
    .eq('id', guestId);
  if (error) throw error;
}

/**
 * Read path for a not-yet-linked invitee (typically a phone invite whose
 * guest_user_id hasn't been auto-linked into the caller's own events list
 * yet) — see the get_invite_preview() RPC in
 * 20260818000002_guest_phone_invites.sql. Returns null if the signed-in
 * session has no matching pending (or already-linked) invite for this event;
 * the RPC itself only ever matches the caller's own row, never anyone else's.
 */
export async function fetchInvitePreview(eventId: string): Promise<InvitePreview | null> {
  const client = supabase;
  const { data, error } = await client.rpc('get_invite_preview', { p_event_id: eventId });
  if (error) throw error;
  const row = (data as InvitePreviewRow[] | null)?.[0];
  return row === undefined ? null : mapInvitePreviewRow(row);
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
