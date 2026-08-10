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
  url: string;
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

/** Everything one guest event page needs, in a single bag. */
export interface EventContent {
  moments: Moment[];
  reactions: MomentReaction[];
  messages: Message[];
  photos: Photo[];
  /** Null until the organizer sets one up. */
  fund: Fund | null;
  contributions: Contribution[];
  schedule: ScheduleItem[];
  venue: Venue;
  /** Null until the organizer sets one up — same convention as fund/venue. */
  menu: Menu | null;
  seatingTables: SeatingTable[];
  accommodations: Accommodation[];
  vendors: Vendor[];
}
