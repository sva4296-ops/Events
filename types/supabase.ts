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
  /** Which plan_features row (by plan_key) this event has picked, if any —
   * see supabase/migrations/20260826000001_event_plan_tier.sql and
   * CLAUDE.md's "Pricing screen". Null until the organizer picks a plan. */
  plan_tier: string | null;
  plan_purchased_at: string | null;
  /** Flipped to 'ready' by the advance_album_status() pg_cron job ~72h after
   * event_date — see 20260812000003_album_status_cron.sql. */
  album_status: 'not_started' | 'generating' | 'ready';
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
  /** When the organizer tapped "Send via WhatsApp" for this guest — distinct
   * from `invited_at` above, which is just row-creation time. Null until
   * sent. See 20260822000001_bulk_guest_invites.sql. */
  whatsapp_sent_at: string | null;
  responded_at: string | null;
  dietary_preferences: string[];
  /** Which seating_tables row this guest is assigned to, if any — see
   * 20260822000002_seating_table_guest_assignment.sql. */
  table_id: string | null;
  /** Picked menu_options row — see 20261001000005_menu_options.sql. */
  menu_option_id: string | null;
  /** Per-guest secret for the web RSVP page (povestea-web, /i/[token]) — see
   * 20260929000001_guest_invite_tokens.sql. */
  invite_token: string;
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

/** Row shape returned by the get_table_companions(uuid) RPC — see
 * supabase/migrations/20260822000003_table_companions_rpc.sql. The caller's
 * own confirmed table-mates only; event_guests' own RLS doesn't let a guest
 * read this any other way. */
export interface TableCompanionRow {
  id: string;
  name: string;
}

/** event_members — co-organizers (20261002000002_event_co_organizers.sql).
 * The owner is implicit (events.organizer_id) and has no row here. */
export interface EventMemberRow {
  id: string;
  event_id: string;
  user_id: string | null;
  role: 'co_organizer' | 'restaurant';
  invited_phone: string | null;
  invited_name: string | null;
  relation: 'groom' | 'bride' | 'godfather' | 'godmother' | null;
  created_at: string;
}

export interface EventWithGuestsRow extends EventRow {
  event_guests: EventGuestRow[];
  /** RLS returns rows only to organizers (and a member's own row), so guests get []. */
  event_members: EventMemberRow[];
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
  latitude: number | null;
  longitude: number | null;
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
  choice_deadline_days: number | null;
}

export interface MenuOptionRow {
  id: string;
  event_id: string;
  name: string;
  /** jsonb array of { name, dish } — see 20261001000006_menu_option_courses.sql. */
  courses: unknown;
  sort_order: number;
}

export interface SeatingTableRow {
  id: string;
  event_id: string;
  name: string;
  label: string | null;
  seat_count: number;
  sort_order: number;
  pos_x: number | null;
  pos_y: number | null;
  shape: string | null;
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
  /** Agency-account-level capabilities from the Agenție pricing tier — not
   * per-event, so they live here rather than on plan_features. Added by
   * 20260824000002_agency_plan_capabilities.sql; see that migration and
   * CLAUDE.md's "Pricing screen" for why. */
  branding_enabled: boolean;
  centralized_panel_enabled: boolean;
  volume_billing_enabled: boolean;
}

export interface UserProfileRow {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
}

/** Row shape for the pricing screen's config table — see
 * supabase/migrations/20260824000001_plan_features.sql. The *_enabled/
 * max_guests columns are real capability flags, one per pricing-card
 * bullet — not free-text — so the client can derive a card's feature list
 * without trusting stored copy to stay in sync with what a plan actually
 * unlocks. Price for a purchasable row is resolved client-side from
 * RevenueCat, never stored here. */
export interface PlanFeatureRow {
  id: string;
  plan_key: string;
  display_name: string;
  is_highlighted: boolean;
  badge_text: string | null;
  button_label: string;
  revenuecat_package_id: string | null;
  is_navigation_only: boolean;
  navigate_to: string | null;
  price_text: string | null;
  sort_order: number;
  rsvp_enabled: boolean;
  progress_feed_enabled: boolean;
  photo_album_enabled: boolean;
  max_guests: number | null;
  contributions_enabled: boolean;
  live_screen_enabled: boolean;
  chat_enabled: boolean;
  lodging_transport_enabled: boolean;
  vendor_tagging_enabled: boolean;
  priority_support_enabled: boolean;
}
