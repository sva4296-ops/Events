import { supabase } from '@/data/supabaseClient';
import type {
  Attendee,
  BillSplit,
  EventPoll,
  PlanItem,
  PlanItemKind,
  PlanItemRating,
  PlanItemVote,
  PollOption,
  PollVote,
  SpontaneousContent,
} from '@/types/spontaneous';

/**
 * Spontaneous-event content: group vote, plan items (songs / who brings what /
 * wines), bill split, attendees. hooks/useSpontaneous.tsx is the only caller.
 * Schema: supabase/migrations/20261022000002_spontaneous_events.sql.
 */

interface PollRow {
  id: string;
  event_id: string;
  question: string;
  options: PollOption[];
}

interface PlanItemRow {
  id: string;
  event_id: string;
  kind: PlanItemKind;
  title: string;
  detail: string | null;
  sort_order: number;
  added_by: string | null;
  added_by_label: string | null;
  claimed_by: string | null;
  claimed_by_label: string | null;
  created_at: string;
}

interface BillSplitRow {
  event_id: string;
  title: string;
  total_amount: number | string;
  people_count: number;
  payment_method: string;
}

interface AttendeeRow {
  guest_id: string;
  name: string;
  rsvp_status: 'confirmed' | 'maybe';
  plus_one: boolean;
  bill_sent_at: string | null;
  bill_confirmed_at: string | null;
  is_me: boolean;
}

function mapPlanItem(row: PlanItemRow): PlanItem {
  return {
    id: row.id,
    eventId: row.event_id,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    sortOrder: row.sort_order,
    addedBy: row.added_by,
    addedByLabel: row.added_by_label,
    claimedBy: row.claimed_by,
    claimedByLabel: row.claimed_by_label,
    createdAt: row.created_at,
  };
}

export async function loadSpontaneous(eventId: string): Promise<SpontaneousContent> {
  const [pollResult, itemsResult, billResult, attendeesResult] = await Promise.all([
    supabase.from('event_polls').select('id, event_id, question, options').eq('event_id', eventId).maybeSingle(),
    supabase.from('plan_items').select('*').eq('event_id', eventId).order('sort_order').order('created_at'),
    supabase.from('bill_splits').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.rpc('get_event_attendees', { p_event_id: eventId }),
  ]);
  if (pollResult.error) throw pollResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (billResult.error) throw billResult.error;
  if (attendeesResult.error) throw attendeesResult.error;

  const pollRow = pollResult.data as PollRow | null;
  const poll: EventPoll | null =
    pollRow === null
      ? null
      : {
          id: pollRow.id,
          eventId: pollRow.event_id,
          question: pollRow.question,
          options: Array.isArray(pollRow.options) ? pollRow.options : [],
        };
  const planItems = (itemsResult.data as PlanItemRow[]).map(mapPlanItem);
  const itemIds = planItems.map((item) => item.id);

  // Needs the poll/item ids, so after the first batch.
  const [votesResult, itemVotesResult, ratingsResult] = await Promise.all([
    poll !== null
      ? supabase.from('event_poll_votes').select('user_id, option_id').eq('poll_id', poll.id)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length > 0
      ? supabase.from('plan_item_votes').select('item_id, user_id').in('item_id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length > 0
      ? supabase.from('plan_item_ratings').select('item_id, user_id, stars').in('item_id', itemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (votesResult.error) throw votesResult.error;
  if (itemVotesResult.error) throw itemVotesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;

  const billRow = billResult.data as BillSplitRow | null;

  return {
    poll,
    pollVotes: ((votesResult.data ?? []) as { user_id: string; option_id: string }[]).map(
      (row): PollVote => ({ userId: row.user_id, optionId: row.option_id }),
    ),
    planItems,
    itemVotes: ((itemVotesResult.data ?? []) as { item_id: string; user_id: string }[]).map(
      (row): PlanItemVote => ({ itemId: row.item_id, userId: row.user_id }),
    ),
    ratings: ((ratingsResult.data ?? []) as { item_id: string; user_id: string; stars: number }[]).map(
      (row): PlanItemRating => ({ itemId: row.item_id, userId: row.user_id, stars: row.stars }),
    ),
    bill:
      billRow === null
        ? null
        : {
            eventId: billRow.event_id,
            title: billRow.title,
            // numeric comes back as a string from PostgREST.
            totalAmount: Number(billRow.total_amount),
            peopleCount: billRow.people_count,
            paymentMethod: billRow.payment_method,
          },
    attendees: ((attendeesResult.data ?? []) as AttendeeRow[]).map(
      (row): Attendee => ({
        guestId: row.guest_id,
        name: row.name,
        status: row.rsvp_status,
        plusOne: row.plus_one,
        billSentAt: row.bill_sent_at,
        billConfirmedAt: row.bill_confirmed_at,
        isMe: row.is_me,
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// Group vote
// ---------------------------------------------------------------------------
export async function savePoll(eventId: string, question: string, options: PollOption[]): Promise<void> {
  const { error } = await supabase
    .from('event_polls')
    .upsert({ event_id: eventId, question, options }, { onConflict: 'event_id' });
  if (error) throw error;
}

export async function deletePoll(eventId: string): Promise<void> {
  const { error } = await supabase.from('event_polls').delete().eq('event_id', eventId);
  if (error) throw error;
}

export async function votePoll(pollId: string, userId: string, optionId: string): Promise<void> {
  const { error } = await supabase
    .from('event_poll_votes')
    .upsert({ poll_id: pollId, user_id: userId, option_id: optionId }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Plan items
// ---------------------------------------------------------------------------
export async function addPlanItem(
  eventId: string,
  kind: PlanItemKind,
  title: string,
  detail: string | null,
  sortOrder: number,
): Promise<void> {
  // added_by / added_by_label are set by the set_plan_item_author trigger.
  const { error } = await supabase
    .from('plan_items')
    .insert({ event_id: eventId, kind, title, detail, sort_order: sortOrder });
  if (error) throw error;
}

export async function deletePlanItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('plan_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function setPlanItemVote(itemId: string, userId: string, voted: boolean): Promise<void> {
  const { error } = voted
    ? await supabase.from('plan_item_votes').insert({ item_id: itemId, user_id: userId })
    : await supabase.from('plan_item_votes').delete().eq('item_id', itemId).eq('user_id', userId);
  if (error) throw error;
}

export async function ratePlanItem(itemId: string, userId: string, stars: number): Promise<void> {
  const { error } = await supabase
    .from('plan_item_ratings')
    .upsert({ item_id: itemId, user_id: userId, stars }, { onConflict: 'item_id,user_id' });
  if (error) throw error;
}

/** Claims an unclaimed 'bring' item, or releases one the caller holds. */
export async function claimPlanItem(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('claim_plan_item', { p_item_id: itemId });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Bill split
// ---------------------------------------------------------------------------
export async function saveBillSplit(bill: BillSplit): Promise<void> {
  const { error } = await supabase.from('bill_splits').upsert(
    {
      event_id: bill.eventId,
      title: bill.title,
      total_amount: bill.totalAmount,
      people_count: bill.peopleCount,
      payment_method: bill.paymentMethod,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'event_id' },
  );
  if (error) throw error;
}

export async function deleteBillSplit(eventId: string): Promise<void> {
  const { error } = await supabase.from('bill_splits').delete().eq('event_id', eventId);
  if (error) throw error;
}

/** The guest's own row ("I've sent my share"). RLS: own row only. */
export async function setBillSent(guestId: string, sent: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_guests')
    .update({ bill_sent_at: sent ? new Date().toISOString() : null })
    .eq('id', guestId);
  if (error) throw error;
}

/** Organizer ticks a payment off (guard_bill_confirmation allows organizers only). */
export async function setBillConfirmed(guestId: string, confirmed: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_guests')
    .update({ bill_confirmed_at: confirmed ? new Date().toISOString() : null })
    .eq('id', guestId);
  if (error) throw error;
}
