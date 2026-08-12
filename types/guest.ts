/**
 * Guest-facing event content. Field names are snake_case on purpose: they mirror
 * the Supabase columns 1:1, so swapping the local repository for a real client
 * needs no field mapping.
 */

export interface Moment {
  id: string;
  event_id: string;
  organizer_id: string;
  title: string;
  photo_url: string;
  created_at: string;
}

/** The two colored pill counters on a moment card: purple and gold. */
export type ReactionType = 'love' | 'celebrate';

export interface MomentReaction {
  id: string;
  moment_id: string;
  user_id: string;
  reaction_type: ReactionType;
}

export interface Message {
  id: string;
  event_id: string;
  sender_id: string;
  sender_label: string;
  content: string;
  created_at: string;
}

export interface Fund {
  id: string;
  event_id: string;
  title: string;
  description: string;
  target_amount: number;
  current_amount: number;
  currency: string;
}

export interface Contribution {
  id: string;
  fund_id: string;
  contributor_name: string;
  amount: number;
  stripe_payment_id: string | null;
  created_at: string;
}

export interface Photo {
  id: string;
  event_id: string;
  uploaded_by: string;
  /** Denormalized at upload time — see the migration adding this column for why. */
  uploaded_by_label: string | null;
  /**
   * Legacy: a local device URI from before real Storage uploads existed —
   * only ever resolves on the device that picked it. Null for every photo
   * uploaded after 20260812000001_event_photos_storage.sql. Kept only as a
   * last-resort fallback for old rows if thumb_url/full_url can't be signed.
   */
  url: string | null;
  /** Signed URL for the 400px-longest-edge version — grid tiles only. */
  thumb_url: string | null;
  /** Signed URL for the 2800px-longest-edge, near-lossless version — full-screen viewer and future album download. */
  full_url: string | null;
  created_at: string;
}

/**
 * Fixture-only for now — the Detalii tab needs these, but they are not part of
 * the v3 Supabase schema you specified. Promote to tables when the backend lands.
 */
export interface ScheduleItem {
  id: string;
  event_id: string;
  time: string;
  title: string;
  location: string;
}

export interface Venue {
  event_id: string;
  name: string;
  address: string;
  notes: string[];
  map_image_url: string;
}

/** One record per event, addressed by event_id — same shape as Venue. */
export interface Menu {
  event_id: string;
  starter: string;
  main: string;
  dessert: string;
}

export interface SeatingTable {
  id: string;
  event_id: string;
  name: string;
  label: string;
  seat_count: number;
}

export interface Accommodation {
  id: string;
  event_id: string;
  name: string;
  detail_line: string;
  price_line: string;
}

export interface Vendor {
  id: string;
  event_id: string;
  name: string;
  category: string;
  handle: string;
  external_url: string;
}

/**
 * The three data-freshness categories useEventContent fetches and caches
 * independently — see hooks/useEventContent.tsx for the staleTime each gets.
 * Together they're the same fields EventContent below has always had; this
 * is only how they're partitioned for caching, not a change to what any
 * screen reads (screens still read the merged `content: EventContent`).
 */

/** Everything that would be Realtime-pushed if Realtime subscriptions existed
 * here (they don't — see CLAUDE.md §7). Highest-churn, most-social content. */
export interface SocialContent {
  moments: Moment[];
  reactions: MomentReaction[];
  messages: Message[];
  photos: Photo[];
}

/** Owner-edited, rarely-changing settings — schedule, venue, menu, seating,
 * accommodations, vendors, and the fund's own settings (not its contributions). */
export interface DetailsContent {
  fund: Fund | null;
  schedule: ScheduleItem[];
  venue: Venue;
  menu: Menu | null;
  seatingTables: SeatingTable[];
  accommodations: Accommodation[];
  vendors: Vendor[];
}

/** The fund's contribution list — a user-action-driven list, same category as
 * the guest list, kept separate from the fund's own settings above. */
export interface ContributionsContent {
  contributions: Contribution[];
}

/** Everything one guest event page needs, in a single bag — the merge of the
 * three categories above. */
export type EventContent = SocialContent & DetailsContent & ContributionsContent;
