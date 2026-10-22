export type EventTypeId =
  | 'wedding'
  | 'baptism'
  | 'birthday'
  | 'cause'
  | 'corporate'
  | 'memorial'
  | 'other'
  | 'spontaneous'
  /** A bar/restaurant night customers book (business accounts only). */
  | 'venue';

/** 'maybe' is only offered on spontaneous events (see 20261022000001_spontaneous_enums.sql). */
export type RsvpStatus = 'confirmed' | 'pending' | 'declined' | 'maybe';

/** events.template — which tool a spontaneous event's Plan tab uses. */
export const SPONTANEOUS_TEMPLATES = ['karaoke', 'party', 'tasting'] as const;
export type SpontaneousTemplate = (typeof SPONTANEOUS_TEMPLATES)[number];

export type Gradient = readonly [string, string];

export interface EventTypeMeta {
  id: EventTypeId;
  label: string;
  emoji: string;
  gradient: Gradient;
  /** Warm Story 2.0 three-stop band: type tiles, event card band, invitation cover. */
  band: readonly [string, string, string];
  /** Icon color that reads on this type's band (ink on light bands, white on dark). */
  bandInk: string;
  accent: string;
}

export interface Guest {
  id: string;
  name: string;
  status: RsvpStatus;
  respondedAt: string | null;
  /** A guest's own preference, editable only on their own row. */
  dietaryPreferences: string[];
  /** Stored digits-only format (see utils/countryCodes.ts's toStoredPhone) —
   * null for an email-only invite. */
  phone: string | null;
  /** When the organizer tapped "Send via WhatsApp" for this guest — null
   * means not yet sent. See app/send-invites/[id].tsx. */
  whatsappSentAt: string | null;
  /** The seating table this guest is assigned to, if any — set from the
   * "Assign guests" section on app/table/[id].tsx. A guest belongs to at
   * most one table for a given event. */
  tableId: string | null;
  /** Picked menu option, if any (app/detalii-menu/[id].tsx). */
  menuOptionId: string | null;
  /** Spontaneous events: bringing one more person. */
  plusOne: boolean;
  /** Spontaneous bill split: guest tapped "I've sent my share". */
  billSentAt: string | null;
  /** Spontaneous bill split: the organizer ticked the payment off. */
  billConfirmedAt: string | null;
  /** Venue events: the booking (null otherwise). */
  partySize: number | null;
  zoneId: string | null;
  bookingTime: string | null;
  bookingCode: string | null;
  checkedInAt: string | null;
  /** Personal link token for the web RSVP page (https://events-web-henna.vercel.app/i/<token>, see INVITE_SITE_URL). */
  inviteToken: string;
}

/** Label only (no extra rights). Add values here and in event_members_relation_check. */
export const CO_ORGANIZER_RELATIONS = ['groom', 'bride', 'godfather', 'godmother'] as const;
export type CoOrganizerRelation = (typeof CO_ORGANIZER_RELATIONS)[number];

/** An event_members row: a co-organizer, or the restaurant (limited access:
 * venue, menu, seating only). `userId` is null until that phone signs in. */
export interface CoOrganizer {
  id: string;
  role: 'co_organizer' | 'restaurant';
  userId: string | null;
  name: string | null;
  phone: string | null;
  /** Null on rows added before labels existed: shown as "Co-organizator". */
  relation: CoOrganizerRelation | null;
}

export interface AppEvent {
  id: string;
  /** Auth user id of the organizer. Absent on events created before auth landed. */
  owner_id?: string;
  /** Set when this event was created by an agency-owner account — see
   * hooks/useEvents.tsx's createEvent. Null for every individually-created
   * event. Not read by any screen today — Home shows every owned event
   * regardless of this field, agency or not (see "Agency accounts" in
   * CLAUDE.md for why the separate agency dashboard that used to filter on
   * it was removed). Kept on the row/type for whatever reads it next. */
  agency_id: string | null;
  type: EventTypeId;
  name: string;
  /** Free-form date string as typed by the organizer, ideally `YYYY-MM-DD`. */
  date: string;
  location: string;
  welcomeMessage: string;
  /** Organizer's own line in the WhatsApp/SMS invitation; '' = the default per-type line. */
  inviteIntro: string;
  createdAt: string;
  guests: Guest[];
  /** Empty for guests (RLS). See hooks/useEvents.tsx's isOwner / isPrimaryOwner. */
  coOrganizers: CoOrganizer[];
  /** plan_features.plan_key this event has picked ('esential'/'complet'/
   * 'premium'/'agentie'), or null before the organizer has chosen one — see
   * app/pricing/[id].tsx and hooks/useEvents.tsx's setPlanTier. */
  planTier: string | null;
  planPurchasedAt: string | null;
  /** events.album_status — 'ready' ~72h after the event date (server cron). */
  albumStatus: 'not_started' | 'generating' | 'ready';
  /** Spontaneous events only (null otherwise). */
  template: SpontaneousTemplate | null;
  /** 'HH:MM', set by the spontaneous wizard. */
  startTime: string | null;
  /** 'YYYY-MM-DD' — "Reply by". */
  replyBy: string | null;
  /** People, guests' +1 included; null = no limit. Enforced by guard_spot_limit. */
  spotLimit: number | null;
  /** Venue events: the venue's name guests see (agency company name at creation). */
  hostName: string | null;
  /** Free text, e.g. "Intrare liberă" or "Bilet 30 lei la intrare, include o băutură". */
  priceInfo: string | null;
  /** 'HH:MM' arrival slots a customer picks from; empty = any. */
  bookingTimes: string[];
  maxPartySize: number;
  /** The venue's public booking link token (…/i/<publicToken>). */
  publicToken: string;
}

/** A bookable area of a venue event (venue_zones). */
export interface VenueZoneDraft {
  /** Stable React key while editing. */
  key: string;
  /** venue_zones.id when editing an existing zone; null = new. */
  id: string | null;
  name: string;
  detail: string;
  /** Typed digits. */
  capacity: string;
}

/** Work-in-progress event inside the 4-step creation wizard. */
export interface EventDraft {
  type: EventTypeId | null;
  name: string;
  date: string;
  location: string;
  welcomeMessage: string;
  /** Spontaneous only; ignored for every other type. */
  template: SpontaneousTemplate | null;
  startTime: string;
  replyBy: string;
  /** Typed digits; empty = no limit. */
  spotLimit: string;
  /** Venue only. */
  zones: VenueZoneDraft[];
  bookingTimes: string[];
  priceInfo: string;
  maxPartySize: string;
}

export interface RsvpCounts {
  confirmed: number;
  pending: number;
  declined: number;
  maybe: number;
  total: number;
}

export interface Agency {
  id: string;
  companyName: string;
  cui: string;
  registrationNumber: string | null;
  address: string | null;
}

/**
 * Narrow event-preview shape for a not-yet-linked invitee, returned by the
 * get_invite_preview RPC — see data/eventsRepository.ts's fetchInvitePreview
 * and app/invite/[id].tsx's fallback branch. EventDraft-compatible
 * (type/name/date/location/welcomeMessage) so it can feed InviteCard
 * directly without a full AppEvent.
 */
export interface InvitePreview {
  eventId: string;
  type: EventTypeId;
  name: string;
  date: string;
  location: string;
  welcomeMessage: string;
  guestId: string;
  rsvpStatus: RsvpStatus;
}
