/**
 * Venue-event ("Local") booking data — get_venue_booking() in
 * supabase/migrations/20261023000002_venue_events.sql, mapped by
 * data/venueRepository.ts, read through hooks/useVenue.tsx.
 */

export interface VenueZone {
  id: string;
  name: string;
  detail: string;
  capacity: number;
  /** People already booked in this zone (confirmed bookings). */
  booked: number;
}

export interface VenueLineupItem {
  time: string;
  title: string;
}

/** The caller's own booking (their event_guests row). */
export interface MyVenueBooking {
  guestId: string;
  status: 'pending' | 'confirmed' | 'declined' | 'maybe';
  partySize: number | null;
  zoneId: string | null;
  bookingTime: string | null;
  bookingCode: string | null;
  checkedInAt: string | null;
}

export interface VenueBooking {
  eventId: string;
  agencyId: string | null;
  name: string;
  hostName: string | null;
  date: string;
  startTime: string | null;
  location: string;
  welcomeMessage: string;
  priceInfo: string | null;
  bookingTimes: string[];
  maxPartySize: number;
  zones: VenueZone[];
  lineup: VenueLineupItem[];
  myBooking: MyVenueBooking | null;
  following: boolean;
  /** People in confirmed bookings, across zones. */
  bookedPeople: number;
  /** Initials of the latest few bookers ("AD"), never names. */
  bookerInitials: string[];
  /** The same venue's next nights (opened through their public link). */
  upcoming: { eventId: string; name: string; date: string; startTime: string | null; publicToken: string }[];
}

/** A customer who agreed to get the venue's invitations (venue_followers). */
export interface VenueFollower {
  userId: string;
  name: string | null;
  /** Digits only, like users.phone. */
  phone: string | null;
  source: 'booking' | 'follow';
  createdAt: string;
}

/** Zone in the venue editor: id null = new. */
export interface VenueZoneInput {
  id: string | null;
  name: string;
  detail: string;
  capacity: number;
}
