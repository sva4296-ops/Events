import { supabase } from '@/data/supabaseClient';
import type {
  Accommodation,
  Contribution,
  ContributionsContent,
  DetailsContent,
  Fund,
  Menu,
  Message,
  Moment,
  MomentReaction,
  Photo,
  ReactionType,
  ScheduleItem,
  SeatingTable,
  SocialContent,
  Vendor,
  Venue,
} from '@/types/guest';
import type {
  AccommodationRow,
  ContributionRow,
  FundRow,
  MenuRow,
  MessageRow,
  MomentReactionRow,
  MomentRow,
  MomentWithReactionsRow,
  PhotoRow,
  ScheduleItemRow,
  SeatingTableRow,
  VendorRow,
  VenueInfoRow,
} from '@/types/supabase';

/**
 * The Supabase-backed content seam. hooks/useEventContent.tsx is the only caller.
 */

/** Who is acting — always the authenticated user, never a hardcoded identity. */
export interface Actor {
  id: string;
  label: string;
}

/** Both resized JPEGs, already produced by utils/imageProcessing.ts — this file only uploads them. */
export interface PhotoUploadVersions {
  thumbnailUri: string;
  fullUri: string;
}

const PHOTO_BUCKET = 'event-photos';
/** Regenerated on every loadSocial (staleTime 30s for this query — see useEventContent.tsx), so this only needs to outlive one render, not be long-lived. */
const PHOTO_SIGNED_URL_TTL_SECONDS = 60 * 60;

function photoStoragePaths(eventId: string, photoId: string) {
  return {
    thumb: `${eventId}/${photoId}/thumb.jpg`,
    full: `${eventId}/${photoId}/full.jpg`,
  };
}

interface FundDraft {
  title: string;
  description: string;
  target_amount: number;
  currency: string;
}

function mapSchedule(row: ScheduleItemRow): ScheduleItem {
  return { id: row.id, event_id: row.event_id, time: row.time, title: row.title, location: row.location ?? '' };
}

function mapVenue(eventId: string, row: VenueInfoRow | null): Venue {
  if (row === null) return { event_id: eventId, name: '', address: '', notes: [], map_image_url: '' };
  return { event_id: eventId, name: row.name ?? '', address: row.address ?? '', notes: row.notes, map_image_url: '' };
}

function mapMoment(row: MomentRow): Moment {
  return {
    id: row.id,
    event_id: row.event_id,
    organizer_id: row.organizer_id,
    title: row.title,
    photo_url: row.photo_url ?? '',
    created_at: row.created_at,
  };
}

function mapReaction(momentId: string, row: MomentReactionRow): MomentReaction {
  return { id: row.id, moment_id: momentId, user_id: row.user_id, reaction_type: row.reaction_type };
}

function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    event_id: row.event_id,
    sender_id: row.sender_id,
    sender_label: row.sender_label,
    content: row.content,
    created_at: row.created_at,
  };
}

function mapFund(row: FundRow): Fund {
  return {
    id: row.id,
    event_id: row.event_id,
    title: row.title,
    description: row.description ?? '',
    target_amount: Number(row.target_amount),
    current_amount: Number(row.current_amount),
    currency: row.currency,
  };
}

function mapContribution(row: ContributionRow): Contribution {
  return {
    id: row.id,
    fund_id: row.fund_id,
    contributor_name: row.contributor_name ?? '',
    amount: Number(row.amount),
    stripe_payment_id: row.stripe_payment_id,
    created_at: row.created_at,
  };
}

function mapPhoto(row: PhotoRow, signed: { thumb_url: string | null; full_url: string | null }): Photo {
  return {
    id: row.id,
    event_id: row.event_id,
    uploaded_by: row.uploaded_by,
    uploaded_by_label: row.uploaded_by_label,
    url: row.url,
    thumb_url: signed.thumb_url,
    full_url: signed.full_url,
    created_at: row.created_at,
  };
}

/**
 * The bucket is private, so every read needs a signed URL — batched into one
 * request for all photos in the event rather than one round trip per photo.
 * Legacy rows (pre-Storage, `url` only) have nothing at these paths; their
 * entries in the response simply come back with signedUrl: null, which
 * mapPhoto handles by falling back to the old `url` column.
 */
async function signPhotoUrls(
  rows: PhotoRow[],
): Promise<Map<string, { thumb_url: string | null; full_url: string | null }>> {
  const result = new Map<string, { thumb_url: string | null; full_url: string | null }>();
  if (rows.length === 0) return result;

  const paths = rows.flatMap((row) => Object.values(photoStoragePaths(row.event_id, row.id)));
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, PHOTO_SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const signedUrlByPath = new Map((data ?? []).map((entry) => [entry.path, entry.signedUrl]));
  for (const row of rows) {
    const { thumb, full } = photoStoragePaths(row.event_id, row.id);
    result.set(row.id, {
      thumb_url: signedUrlByPath.get(thumb) ?? null,
      full_url: signedUrlByPath.get(full) ?? null,
    });
  }
  return result;
}

function mapMenu(eventId: string, row: MenuRow | null): Menu | null {
  if (row === null) return null;
  return { event_id: eventId, starter: row.starter ?? '', main: row.main ?? '', dessert: row.dessert ?? '' };
}

function mapSeatingTable(row: SeatingTableRow): SeatingTable {
  return { id: row.id, event_id: row.event_id, name: row.name, label: row.label ?? '', seat_count: row.seat_count };
}

function mapAccommodation(row: AccommodationRow): Accommodation {
  return {
    id: row.id,
    event_id: row.event_id,
    name: row.name,
    detail_line: row.detail_line ?? '',
    price_line: row.price_line ?? '',
  };
}

function mapVendor(row: VendorRow): Vendor {
  return {
    id: row.id,
    event_id: row.event_id,
    name: row.name,
    category: row.category ?? '',
    handle: row.handle ?? '',
    external_url: row.external_url ?? '',
  };
}

/**
 * Moments/reactions/messages/photos — the highest-churn, most-social slice.
 * Split out from the other two so it can be cached with its own staleTime;
 * see hooks/useEventContent.tsx for why that's still a short one (no Realtime
 * subscriptions push into this cache, despite the content).
 */
async function loadSocial(eventId: string): Promise<SocialContent> {
  const client = supabase;

  const [momentsRes, messagesRes, photosRes] = await Promise.all([
    client
      .from('moments')
      .select('*, moment_reactions(*)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false }),
    client.from('messages').select('*').eq('event_id', eventId).order('created_at', { ascending: true }),
    client.from('photos').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
  ]);

  for (const res of [momentsRes, messagesRes, photosRes]) {
    if (res.error) throw res.error;
  }

  const momentRows = (momentsRes.data ?? []) as MomentWithReactionsRow[];
  const moments = momentRows.map(mapMoment);
  const reactions = momentRows.flatMap((row) => row.moment_reactions.map((r) => mapReaction(row.id, r)));

  const photoRows = photosRes.data as PhotoRow[];
  const signedByPhotoId = await signPhotoUrls(photoRows);
  const photos = photoRows.map((row) =>
    mapPhoto(row, signedByPhotoId.get(row.id) ?? { thumb_url: null, full_url: null }),
  );

  return {
    moments,
    reactions,
    messages: (messagesRes.data as MessageRow[]).map(mapMessage),
    photos,
  };
}

/**
 * Schedule, venue, menu, seating, accommodations, vendors, and the fund's own
 * settings (title/description/target/current amount — not its contributions,
 * see loadContributions below). All owner-edited, all rarely changing.
 */
async function loadDetails(eventId: string): Promise<DetailsContent> {
  const client = supabase;

  const [scheduleRes, venueRes, fundRes, menuRes, seatingRes, accommodationsRes, vendorsRes] =
    await Promise.all([
      client
        .from('schedule_items')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true }),
      client.from('venue_info').select('*').eq('event_id', eventId).maybeSingle(),
      client.from('fund').select('*').eq('event_id', eventId).maybeSingle(),
      client.from('menu').select('*').eq('event_id', eventId).maybeSingle(),
      client.from('seating_tables').select('*').eq('event_id', eventId).order('sort_order', { ascending: true }),
      client.from('accommodations').select('*').eq('event_id', eventId).order('sort_order', { ascending: true }),
      client.from('vendors').select('*').eq('event_id', eventId).order('sort_order', { ascending: true }),
    ]);

  for (const res of [scheduleRes, venueRes, fundRes, menuRes, seatingRes, accommodationsRes, vendorsRes]) {
    if (res.error) throw res.error;
  }

  const fundRow = fundRes.data as FundRow | null;

  return {
    fund: fundRow === null ? null : mapFund(fundRow),
    schedule: (scheduleRes.data as ScheduleItemRow[]).map(mapSchedule),
    venue: mapVenue(eventId, venueRes.data as VenueInfoRow | null),
    menu: mapMenu(eventId, menuRes.data as MenuRow | null),
    seatingTables: (seatingRes.data as SeatingTableRow[]).map(mapSeatingTable),
    accommodations: (accommodationsRes.data as AccommodationRow[]).map(mapAccommodation),
    vendors: (vendorsRes.data as VendorRow[]).map(mapVendor),
  };
}

/**
 * The fund's contribution list — a user-action-driven list, cached
 * independently of the fund's own settings above. Looks up the fund id
 * itself (a second, cheap read) rather than depending on loadDetails's
 * result, so this query stays independent and gets its own staleTime.
 */
async function loadContributions(eventId: string): Promise<ContributionsContent> {
  const client = supabase;

  const { data: fundRow, error: fundError } = await client
    .from('fund')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (fundError) throw fundError;
  if (fundRow === null) return { contributions: [] };

  const { data, error } = await client
    .from('contributions')
    .select('*')
    .eq('fund_id', fundRow.id)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return { contributions: (data as ContributionRow[]).map(mapContribution) };
}

async function sendMessage(eventId: string, content: string, actor: Actor): Promise<void> {
  const client = supabase;
  const { error } = await client
    .from('messages')
    .insert({ event_id: eventId, sender_id: actor.id, sender_label: actor.label, content });
  if (error) throw error;
}

async function deleteMessage(messageId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('messages').delete().eq('id', messageId);
  if (error) throw error;
}

async function addReaction(momentId: string, reaction: ReactionType, actor: Actor): Promise<void> {
  const client = supabase;
  const { error } = await client
    .from('moment_reactions')
    .insert({ moment_id: momentId, user_id: actor.id, reaction_type: reaction });
  if (error) throw error;
}

async function removeReaction(momentId: string, reaction: ReactionType, actor: Actor): Promise<void> {
  const client = supabase;
  const { error } = await client
    .from('moment_reactions')
    .delete()
    .eq('moment_id', momentId)
    .eq('user_id', actor.id)
    .eq('reaction_type', reaction);
  if (error) throw error;
}

/**
 * RLS lets a session read its own public.users row (just not anyone else's), so
 * the uploader can look up their own display_name here and store it on the row
 * — see the migration adding uploaded_by_label for why this can't be a join.
 */
/**
 * photoId is generated by the caller (utils/uuid.ts), not left to Postgres's
 * default, because the Storage paths ({eventId}/{photoId}/...) have to be
 * known before the `photos` row is inserted — upload both resized versions
 * first, then insert the row pointing at a path convention that already
 * exists in Storage, rather than the other way around.
 */
async function addPhoto(
  eventId: string,
  photoId: string,
  versions: PhotoUploadVersions,
  actor: Actor,
): Promise<void> {
  const client = supabase;
  const { thumb, full } = photoStoragePaths(eventId, photoId);

  const [thumbBuffer, fullBuffer] = await Promise.all([
    fetch(versions.thumbnailUri).then((res) => res.arrayBuffer()),
    fetch(versions.fullUri).then((res) => res.arrayBuffer()),
  ]);

  const [thumbUpload, fullUpload] = await Promise.all([
    client.storage.from(PHOTO_BUCKET).upload(thumb, thumbBuffer, { contentType: 'image/jpeg' }),
    client.storage.from(PHOTO_BUCKET).upload(full, fullBuffer, { contentType: 'image/jpeg' }),
  ]);
  if (thumbUpload.error) throw thumbUpload.error;
  if (fullUpload.error) throw fullUpload.error;

  const { data: profile } = await client
    .from('users')
    .select('display_name')
    .eq('id', actor.id)
    .maybeSingle();
  const label = profile?.display_name ?? actor.label;

  const { error } = await client
    .from('photos')
    .insert({ id: photoId, event_id: eventId, uploaded_by: actor.id, uploaded_by_label: label });
  if (error) throw error;
}

async function deletePhoto(eventId: string, photoId: string): Promise<void> {
  const client = supabase;
  const { thumb, full } = photoStoragePaths(eventId, photoId);
  // Best-effort: a legacy row has nothing at these paths, and a partial
  // Storage failure shouldn't block removing the row itself (same
  // fire-and-forget-cleanup philosophy as markOnboardingComplete — see
  // CLAUDE.md). .remove() never throws, just reports per-path errors we
  // don't act on here.
  await client.storage.from(PHOTO_BUCKET).remove([thumb, full]);

  const { error } = await client.from('photos').delete().eq('id', photoId);
  if (error) throw error;
}

async function createMoment(eventId: string, title: string, photoUrl: string, actor: Actor): Promise<void> {
  const client = supabase;
  const { error } = await client.from('moments').insert({
    event_id: eventId,
    organizer_id: actor.id,
    title,
    photo_url: photoUrl.length > 0 ? photoUrl : null,
  });
  if (error) throw error;
}

async function deleteMoment(momentId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('moments').delete().eq('id', momentId);
  if (error) throw error;
}

async function saveFund(eventId: string, input: FundDraft, existingId: string | null): Promise<void> {
  const client = supabase;
  if (existingId === null) {
    const { error } = await client.from('fund').insert({ event_id: eventId, ...input });
    if (error) throw error;
    return;
  }
  const { error } = await client.from('fund').update(input).eq('id', existingId);
  if (error) throw error;
}

async function deleteFund(eventId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('fund').delete().eq('event_id', eventId);
  if (error) throw error;
}

interface ScheduleItemDraft {
  id: string | null;
  time: string;
  title: string;
  location: string;
}

async function saveScheduleItem(eventId: string, item: ScheduleItemDraft, sortOrder: number): Promise<void> {
  const client = supabase;
  if (item.id === null) {
    const { error } = await client
      .from('schedule_items')
      .insert({ event_id: eventId, time: item.time, title: item.title, location: item.location, sort_order: sortOrder });
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from('schedule_items')
    .update({ time: item.time, title: item.title, location: item.location })
    .eq('id', item.id);
  if (error) throw error;
}

async function deleteScheduleItem(itemId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('schedule_items').delete().eq('id', itemId);
  if (error) throw error;
}

async function updateVenue(venue: Venue): Promise<void> {
  const client = supabase;
  const { error } = await client
    .from('venue_info')
    .upsert({ event_id: venue.event_id, name: venue.name, address: venue.address, notes: venue.notes }, { onConflict: 'event_id' });
  if (error) throw error;
}

interface MenuDraft {
  starter: string;
  main: string;
  dessert: string;
}

/** menu.event_id is a full (non-partial) unique constraint, unlike event_guests'
 * — upsert's bare ON CONFLICT works fine here, same as fund/venue_info. */
async function saveMenu(eventId: string, input: MenuDraft): Promise<void> {
  const client = supabase;
  const { error } = await client
    .from('menu')
    .upsert({ event_id: eventId, ...input }, { onConflict: 'event_id' });
  if (error) throw error;
}

interface SeatingTableDraft {
  id: string | null;
  name: string;
  label: string;
  seat_count: number;
  /** Confirmed guests' ids to assign to this table — see
   * app/table/[id].tsx's "Assign guests" section. Replaces whatever this
   * table's assignment set was before the save, in one call. */
  guestIds: string[];
}

/**
 * Upserts the table row, then (re)assigns event_guests.table_id for it in
 * the same call — one save action covers both, so the composer screen never
 * has to sequence "save table, then use its id to assign guests" itself.
 * Reassignment is "clear everyone currently on this table, then set the new
 * selection" rather than a diff — simpler, and correct either way since a
 * guest belongs to at most one table (see the migration's own reasoning).
 */
async function saveSeatingTable(
  eventId: string,
  item: SeatingTableDraft,
  sortOrder: number,
): Promise<void> {
  const client = supabase;
  let tableId = item.id;

  if (tableId === null) {
    const { data, error } = await client
      .from('seating_tables')
      .insert({
        event_id: eventId,
        name: item.name,
        label: item.label,
        seat_count: item.seat_count,
        sort_order: sortOrder,
      })
      .select('id')
      .single();
    if (error) throw error;
    tableId = (data as { id: string }).id;
  } else {
    const { error } = await client
      .from('seating_tables')
      .update({ name: item.name, label: item.label, seat_count: item.seat_count })
      .eq('id', tableId);
    if (error) throw error;
  }

  const { error: clearError } = await client
    .from('event_guests')
    .update({ table_id: null })
    .eq('table_id', tableId);
  if (clearError) throw clearError;

  if (item.guestIds.length > 0) {
    const { error: assignError } = await client
      .from('event_guests')
      .update({ table_id: tableId })
      .in('id', item.guestIds);
    if (assignError) throw assignError;
  }
}

async function deleteSeatingTable(tableId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('seating_tables').delete().eq('id', tableId);
  if (error) throw error;
}

interface AccommodationDraft {
  id: string | null;
  name: string;
  detail_line: string;
  price_line: string;
}

async function saveAccommodation(
  eventId: string,
  item: AccommodationDraft,
  sortOrder: number,
): Promise<void> {
  const client = supabase;
  if (item.id === null) {
    const { error } = await client.from('accommodations').insert({
      event_id: eventId,
      name: item.name,
      detail_line: item.detail_line,
      price_line: item.price_line,
      sort_order: sortOrder,
    });
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from('accommodations')
    .update({ name: item.name, detail_line: item.detail_line, price_line: item.price_line })
    .eq('id', item.id);
  if (error) throw error;
}

async function deleteAccommodation(accommodationId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('accommodations').delete().eq('id', accommodationId);
  if (error) throw error;
}

interface VendorDraft {
  id: string | null;
  name: string;
  category: string;
  handle: string;
  external_url: string;
}

async function saveVendor(eventId: string, item: VendorDraft, sortOrder: number): Promise<void> {
  const client = supabase;
  if (item.id === null) {
    const { error } = await client.from('vendors').insert({
      event_id: eventId,
      name: item.name,
      category: item.category,
      handle: item.handle,
      external_url: item.external_url.length > 0 ? item.external_url : null,
      sort_order: sortOrder,
    });
    if (error) throw error;
    return;
  }
  const { error } = await client
    .from('vendors')
    .update({
      name: item.name,
      category: item.category,
      handle: item.handle,
      external_url: item.external_url.length > 0 ? item.external_url : null,
    })
    .eq('id', item.id);
  if (error) throw error;
}

async function deleteVendor(vendorId: string): Promise<void> {
  const client = supabase;
  const { error } = await client.from('vendors').delete().eq('id', vendorId);
  if (error) throw error;
}

export const remoteRepository = {
  loadSocial,
  loadDetails,
  loadContributions,
  sendMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  addPhoto,
  deletePhoto,
  createMoment,
  deleteMoment,
  saveFund,
  deleteFund,
  saveScheduleItem,
  deleteScheduleItem,
  updateVenue,
  saveMenu,
  saveSeatingTable,
  deleteSeatingTable,
  saveAccommodation,
  deleteAccommodation,
  saveVendor,
  deleteVendor,
};
