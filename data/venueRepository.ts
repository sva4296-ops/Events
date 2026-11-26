import { supabase } from '@/data/supabaseClient';
import type { VenueBooking, VenueFollower, VenueZoneInput } from '@/types/venue';

/**
 * Venue events ("Local"): booking page data, booking, followers, zones,
 * check-in. hooks/useVenue.tsx and app/i/[token].tsx are the callers.
 * Schema: supabase/migrations/20261023000002_venue_events.sql.
 */

interface VenueBookingRow {
  event_id: string;
  agency_id: string | null;
  name: string;
  host_name: string | null;
  event_date: string | null;
  start_time: string | null;
  location: string | null;
  welcome_message: string | null;
  price_info: string | null;
  booking_times: string[] | null;
  max_party_size: number;
  zones: { id: string; name: string; detail: string; capacity: number; booked: number }[];
  lineup: { time: string; title: string }[];
  my_booking: {
    guest_id: string;
    rsvp_status: 'pending' | 'confirmed' | 'declined' | 'maybe';
    party_size: number | null;
    zone_id: string | null;
    booking_time: string | null;
    booking_code: string | null;
    checked_in_at: string | null;
  } | null;
  following: boolean;
  // Added by 20261023000003; absent until that migration is applied.
  booked_people?: number | string;
  booker_initials?: string[];
  upcoming?: { event_id: string; name: string; event_date: string | null; start_time: string | null; public_token: string }[];
}

/** The public link token → event id. Works signed out (anon). */
export async function resolveVenueToken(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_venue_token', { p_token: token });
  if (error) throw error;
  return (data as string | null) ?? null;
}

/** Null when the event isn't a venue event or the caller can't see it. */
export async function fetchVenueBooking(eventId: string, token: string | null): Promise<VenueBooking | null> {
  const { data, error } = await supabase.rpc('get_venue_booking', { p_event_id: eventId, p_token: token });
  if (error) throw error;
  const row = data as VenueBookingRow | null;
  if (row === null) return null;
  return {
    eventId: row.event_id,
    agencyId: row.agency_id,
    name: row.name,
    hostName: row.host_name,
    date: row.event_date ?? '',
    startTime: row.start_time,
    location: row.location ?? '',
    welcomeMessage: row.welcome_message ?? '',
    priceInfo: row.price_info,
    bookingTimes: row.booking_times ?? [],
    maxPartySize: row.max_party_size,
    zones: row.zones.map((zone) => ({ ...zone, booked: Number(zone.booked) })),
    lineup: row.lineup,
    myBooking:
      row.my_booking === null
        ? null
        : {
            guestId: row.my_booking.guest_id,
            status: row.my_booking.rsvp_status,
            partySize: row.my_booking.party_size,
            zoneId: row.my_booking.zone_id,
            bookingTime: row.my_booking.booking_time,
            bookingCode: row.my_booking.booking_code,
            checkedInAt: row.my_booking.checked_in_at,
          },
    following: row.following,
    bookedPeople: Number(row.booked_people ?? row.zones.reduce((sum, zone) => sum + Number(zone.booked), 0)),
    bookerInitials: row.booker_initials ?? [],
    upcoming: (row.upcoming ?? []).map((night) => ({
      eventId: night.event_id,
      name: night.name,
      date: night.event_date ?? '',
      startTime: night.start_time,
      publicToken: night.public_token,
    })),
  };
}

export interface BookVenueInput {
  eventId: string;
  token: string | null;
  partySize: number;
  zoneId: string;
  time: string;
  follow: boolean;
}

/** Returns the booking code. Raises 'zone_full' when the zone has no room. */
export async function bookVenue(input: BookVenueInput): Promise<string> {
  const { data, error } = await supabase.rpc('book_venue_event', {
    p_event_id: input.eventId,
    p_token: input.token,
    p_party_size: input.partySize,
    p_zone_id: input.zoneId,
    p_time: input.time,
    p_follow: input.follow,
  });
  if (error) throw error;
  return data as string;
}

/** The guest's own row → declined (frees the spots). RLS: own row only. */
export async function cancelVenueBooking(guestId: string): Promise<void> {
  const { error } = await supabase
    .from('event_guests')
    .update({ rsvp_status: 'declined', responded_at: new Date().toISOString() })
    .eq('id', guestId);
  if (error) throw error;
}

export async function setVenueFollow(agencyId: string, follow: boolean, userId: string): Promise<void> {
  const { error } = follow
    ? await supabase.from('venue_followers').upsert({ agency_id: agencyId, source: 'follow' }, { onConflict: 'agency_id,user_id', ignoreDuplicates: true })
    : await supabase.from('venue_followers').delete().eq('agency_id', agencyId).eq('user_id', userId);
  if (error) throw error;
}

/** Venue owner only (RLS). Newest first. */
export async function fetchVenueFollowers(agencyId: string): Promise<VenueFollower[]> {
  const { data, error } = await supabase
    .from('venue_followers')
    .select('user_id, name, phone, source, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as { user_id: string; name: string | null; phone: string | null; source: 'booking' | 'follow'; created_at: string }[]).map(
    (row) => ({ userId: row.user_id, name: row.name, phone: row.phone, source: row.source, createdAt: row.created_at }),
  );
}

/** Replaces the event's zones: updates kept ones, inserts new ones, deletes the rest. */
export async function saveVenueZones(eventId: string, zones: VenueZoneInput[]): Promise<void> {
  const { data: existing, error: readError } = await supabase.from('venue_zones').select('id').eq('event_id', eventId);
  if (readError) throw readError;
  const keep = new Set(zones.map((zone) => zone.id).filter((id): id is string => id !== null));
  const removed = (existing as { id: string }[]).map((row) => row.id).filter((id) => !keep.has(id));
  if (removed.length > 0) {
    const { error } = await supabase.from('venue_zones').delete().in('id', removed);
    if (error) throw error;
  }
  for (const [index, zone] of zones.entries()) {
    const row = { event_id: eventId, name: zone.name, detail: zone.detail, capacity: zone.capacity, sort_order: index };
    const { error } =
      zone.id === null
        ? await supabase.from('venue_zones').insert(row)
        : await supabase.from('venue_zones').update(row).eq('id', zone.id);
    if (error) throw error;
  }
}

/** Organizer marks a booking as arrived (or undoes it). */
export async function setCheckedIn(guestId: string, checkedIn: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_guests')
    .update({ checked_in_at: checkedIn ? new Date().toISOString() : null })
    .eq('id', guestId);
  if (error) throw error;
}
