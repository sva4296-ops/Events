export type EventTypeId =
  | 'wedding'
  | 'baptism'
  | 'birthday'
  | 'cause'
  | 'corporate'
  | 'memorial'
  | 'other';

export type RsvpStatus = 'confirmed' | 'pending' | 'declined';

export type Gradient = readonly [string, string];

export interface EventTypeMeta {
  id: EventTypeId;
  label: string;
  emoji: string;
  gradient: Gradient;
  accent: string;
}

export interface Guest {
  id: string;
  name: string;
  status: RsvpStatus;
  respondedAt: string | null;
  /** A guest's own preference, editable only on their own row. */
  dietaryPreferences: string[];
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
  createdAt: string;
  guests: Guest[];
}

/** Work-in-progress event inside the 4-step creation wizard. */
export interface EventDraft {
  type: EventTypeId | null;
  name: string;
  date: string;
  location: string;
  welcomeMessage: string;
}

export interface RsvpCounts {
  confirmed: number;
  pending: number;
  declined: number;
  total: number;
}

export interface Agency {
  id: string;
  companyName: string;
  cui: string;
  registrationNumber: string | null;
  address: string | null;
}
