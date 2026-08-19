/**
 * Row shapes for the tables in supabase/migrations/20260810000001_initial_schema.sql,
 * as returned by supabase-js. Column names are snake_case to match Postgres exactly —
 * the repositories in data/ map these onto the camelCase app types.
 */

export type EventTypeRow =
  | 'wedding'
  | 'baptism'
  | 'birthday'
  | 'cause'
  | 'corporate'
  | 'memorial'
  | 'other';

export type RsvpStatusRow = 'pending' | 'confirmed' | 'declined';

export type ReactionTypeRow = 'love' | 'celebrate';

export interface EventRow {
  id: string;
  organizer_id: string;
  agency_id: string | null;
  type: EventTypeRow;
  name: string;
  event_date: string | null;
  location: string | null;
  welcome_message: string | null;
  created_at: string;
}

export interface EventGuestRow {
  id: string;
  event_id: string;
  guest_user_id: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_name: string | null;
  rsvp_status: RsvpStatusRow;
  invited_at: string;
  responded_at: string | null;
  dietary_preferences: string[];
}

/** Row shape returned by the get_invite_preview(uuid) RPC — see
 * supabase/migrations/20260818000002_guest_phone_invites.sql. Narrower than
 * EventWithGuestsRow on purpose: it's the read path for a not-yet-linked
 * invitee, before the normal events-list RLS necessarily applies to them. */
export interface InvitePreviewRow {
  event_id: string;
  name: string;
  type: EventTypeRow;
  event_date: string | null;
  location: string | null;
  welcome_message: string | null;
  guest_id: string;
  rsvp_status: RsvpStatusRow;
}

export interface EventWithGuestsRow extends EventRow {
  event_guests: EventGuestRow[];
}

export interface ScheduleItemRow {
  id: string;
  event_id: string;
  time: string;
  title: string;
  location: string | null;
  sort_order: number;
}

export interface VenueInfoRow {
  id: string;
  event_id: string;
  name: string | null;
  address: string | null;
  notes: string[];
}

export interface MomentRow {
  id: string;
  event_id: string;
  organizer_id: string;
  title: string;
  photo_url: string | null;
  created_at: string;
}

export interface MomentReactionRow {
  id: string;
  moment_id: string;
  user_id: string;
  reaction_type: ReactionTypeRow;
}

export interface MomentWithReactionsRow extends MomentRow {
  moment_reactions: MomentReactionRow[];
}

export interface MessageRow {
  id: string;
  event_id: string;
  sender_id: string;
  sender_label: string;
  content: string;
  created_at: string;
}

export interface FundRow {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  currency: string;
}

export interface ContributionRow {
  id: string;
  fund_id: string;
  contributor_name: string | null;
  amount: number;
  stripe_payment_id: string | null;
  created_at: string;
}

export interface PhotoRow {
  id: string;
  event_id: string;
  uploaded_by: string;
  uploaded_by_label: string | null;
  url: string | null;
  created_at: string;
}

export interface MenuRow {
  id: string;
  event_id: string;
  starter: string | null;
  main: string | null;
  dessert: string | null;
}

export interface SeatingTableRow {
  id: string;
  event_id: string;
  name: string;
  label: string | null;
  seat_count: number;
  sort_order: number;
}

export interface AccommodationRow {
  id: string;
  event_id: string;
  name: string;
  detail_line: string | null;
  price_line: string | null;
  sort_order: number;
}

export interface VendorRow {
  id: string;
  event_id: string;
  name: string;
  category: string | null;
  handle: string | null;
  external_url: string | null;
  sort_order: number;
}

export interface AgencyRow {
  id: string;
  owner_user_id: string;
  company_name: string;
  cui: string;
  registration_number: string | null;
  address: string | null;
  created_at: string;
}

export interface UserProfileRow {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
}
