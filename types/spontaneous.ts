/**
 * Spontaneous-event content (karaoke / party / wine tasting) — tables from
 * supabase/migrations/20261022000002_spontaneous_events.sql, mapped by
 * data/spontaneousRepository.ts, read through hooks/useSpontaneous.tsx.
 */

export interface PollOption {
  id: string;
  label: string;
}

/** One group vote per event ("What time do we meet?"). */
export interface EventPoll {
  id: string;
  eventId: string;
  question: string;
  options: PollOption[];
}

export interface PollVote {
  userId: string;
  optionId: string;
}

/** 'song' = karaoke queue, 'bring' = who brings what, 'wine' = tasting sheet. */
export type PlanItemKind = 'song' | 'bring' | 'wine';

export interface PlanItem {
  id: string;
  eventId: string;
  kind: PlanItemKind;
  title: string;
  /** Artist for a song, style for a wine. */
  detail: string | null;
  sortOrder: number;
  addedBy: string | null;
  addedByLabel: string | null;
  claimedBy: string | null;
  claimedByLabel: string | null;
  createdAt: string;
}

export interface PlanItemVote {
  itemId: string;
  userId: string;
}

export interface PlanItemRating {
  itemId: string;
  userId: string;
  stars: number;
}

/** Total ÷ people. The money never goes through the app. */
export interface BillSplit {
  eventId: string;
  title: string;
  totalAmount: number;
  peopleCount: number;
  paymentMethod: string;
}

/** A guest who said yes or maybe (get_event_attendees RPC). */
export interface Attendee {
  guestId: string;
  name: string;
  status: 'confirmed' | 'maybe';
  plusOne: boolean;
  billSentAt: string | null;
  billConfirmedAt: string | null;
  isMe: boolean;
}

export interface SpontaneousContent {
  poll: EventPoll | null;
  pollVotes: PollVote[];
  planItems: PlanItem[];
  itemVotes: PlanItemVote[];
  ratings: PlanItemRating[];
  bill: BillSplit | null;
  attendees: Attendee[];
}
