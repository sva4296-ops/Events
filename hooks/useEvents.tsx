import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchEventById,
  fetchEvents,
  insertEvent,
  insertGuestInvite,
  removeGuestRow,
  respondToInviteRow,
  updateDietaryPreferencesRow,
  updateEventRow,
} from '@/data/eventsRepository';
import { useAuth } from '@/hooks/useAuth';
import type { AppEvent, EventDraft, RsvpStatus } from '@/types/event';
import { SELF_GUEST_ID, SELF_GUEST_NAME } from '@/utils/guests';
import { createId } from '@/utils/id';
import { reportSupabaseError } from '@/utils/reportError';
import { loadEvents, saveEvents } from '@/utils/storage';

interface EventsContextValue {
  events: AppEvent[];
  /** False until the initial read (AsyncStorage or Supabase) completes, so lists don't flash empty. */
  hydrated: boolean;
  getEvent: (id: string | undefined) => AppEvent | undefined;
  createEvent: (draft: EventDraft) => Promise<AppEvent>;
  updateEvent: (eventId: string, patch: Partial<Omit<AppEvent, 'id' | 'owner_id'>>) => Promise<void>;
  respondToInvite: (eventId: string, status: Exclude<RsvpStatus, 'pending'>) => void;
  removeGuest: (eventId: string, guestId: string) => void;
  /** Supabase mode only — see app/add-guest/[id].tsx, which gates this out otherwise. */
  addGuest: (eventId: string, email: string, name: string) => Promise<void>;
  /** A signed-in non-organizer's own preference — no-op for an owner (no guest row to write to). */
  updateMyDietaryPreferences: (eventId: string, preferences: string[]) => void;
  /** Legacy events without an owner belong to whoever is on this device. */
  isOwner: (event: AppEvent | undefined) => boolean;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: ReactNode }) {
  const { user, mode } = useAuth();
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // ---- local fallback: AsyncStorage, unchanged from before Supabase wiring ----
  useEffect(() => {
    if (mode !== 'local') return;
    let active = true;
    void loadEvents().then((stored) => {
      if (!active) return;
      setEvents(stored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'local' || !hydrated) return;
    void saveEvents(events);
  }, [events, hydrated, mode]);

  // ---- supabase: fetch on session, refetch after every mutation ----
  const refetch = useCallback(async () => {
    try {
      const fresh = await fetchEvents();
      setEvents(fresh);
    } catch (error) {
      reportSupabaseError(error);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (mode !== 'supabase') return;
    if (user === null) {
      setEvents([]);
      setHydrated(true);
      return;
    }
    setHydrated(false);
    void refetch();
  }, [mode, user, refetch]);

  const getEvent = useCallback(
    (id: string | undefined) => (id === undefined ? undefined : events.find((e) => e.id === id)),
    [events],
  );

  const createEvent = useCallback(
    async (draft: EventDraft): Promise<AppEvent> => {
      if (mode === 'supabase') {
        const event = await insertEvent(draft, user?.id ?? '');
        setEvents((current) => [event, ...current]);
        return event;
      }

      const event: AppEvent = {
        id: createId(),
        owner_id: user?.id,
        type: draft.type ?? 'other',
        name: draft.name.trim(),
        date: draft.date.trim(),
        location: draft.location.trim(),
        welcomeMessage: draft.welcomeMessage.trim(),
        createdAt: new Date().toISOString(),
        // Real guests only: they arrive by RSVP'ing to an invite link.
        guests: [],
      };
      setEvents((current) => [event, ...current]);
      return event;
    },
    [user, mode],
  );

  const updateEvent = useCallback(
    async (eventId: string, patch: Partial<Omit<AppEvent, 'id' | 'owner_id'>>): Promise<void> => {
      if (mode === 'supabase') {
        await updateEventRow(eventId, patch);
        setEvents((current) =>
          current.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
        );
        return;
      }

      setEvents((current) =>
        current.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
      );
    },
    [mode],
  );

  const removeGuest = useCallback(
    (eventId: string, guestId: string) => {
      if (mode === 'supabase') {
        setEvents((current) =>
          current.map((event) =>
            event.id === eventId
              ? { ...event, guests: event.guests.filter((guest) => guest.id !== guestId) }
              : event,
          ),
        );
        removeGuestRow(guestId).catch((error: unknown) => {
          reportSupabaseError(error);
          void refetch();
        });
        return;
      }

      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? { ...event, guests: event.guests.filter((guest) => guest.id !== guestId) }
            : event,
        ),
      );
    },
    [mode, refetch],
  );

  /**
   * Refetches the single event after insert rather than patching optimistically:
   * the on_event_guest_insert trigger may have auto-linked guest_user_id server-
   * side, and there's no way to know that client-side ahead of the round trip.
   */
  const addGuest = useCallback(async (eventId: string, email: string, name: string): Promise<void> => {
    await insertGuestInvite(eventId, email, name);
    const fresh = await fetchEventById(eventId);
    if (fresh === null) return;
    setEvents((current) => current.map((event) => (event.id === eventId ? fresh : event)));
  }, []);

  const isOwner = useCallback(
    (event: AppEvent | undefined) => {
      if (event === undefined) return false;
      // Signed in: ownership is strictly the session's user, so a new account
      // never inherits events left on this device by an earlier build.
      if (user !== null && mode === 'supabase') return event.owner_id === user.id;
      return event.owner_id === undefined || (user !== null && event.owner_id === user.id);
    },
    [user, mode],
  );

  const respondToInvite = useCallback(
    (eventId: string, status: Exclude<RsvpStatus, 'pending'>) => {
      if (mode === 'supabase' && user !== null) {
        respondToInviteRow(eventId, user.id, user.label, status)
          .then(refetch)
          .catch((error: unknown) => reportSupabaseError(error));
        return;
      }

      setEvents((current) =>
        current.map((event) => {
          if (event.id !== eventId) return event;

          const respondedAt = new Date().toISOString();
          const alreadyResponded = event.guests.some((guest) => guest.id === SELF_GUEST_ID);
          const guests = alreadyResponded
            ? event.guests.map((guest) =>
                guest.id === SELF_GUEST_ID ? { ...guest, status, respondedAt } : guest,
              )
            : [
                {
                  id: SELF_GUEST_ID,
                  name: SELF_GUEST_NAME,
                  status,
                  respondedAt,
                  dietaryPreferences: [],
                },
                ...event.guests,
              ];

          return { ...event, guests };
        }),
      );
    },
    [mode, user, refetch],
  );

  const updateMyDietaryPreferences = useCallback(
    (eventId: string, preferences: string[]) => {
      if (mode === 'supabase' && user !== null) {
        // Optimistic: RLS already limits a non-organizer's event.guests to just
        // their own row, so index 0 is "my" row — same convention used
        // throughout (myRsvp, myInvitations).
        setEvents((current) =>
          current.map((event) =>
            event.id === eventId
              ? {
                  ...event,
                  guests: event.guests.map((guest, index) =>
                    index === 0 ? { ...guest, dietaryPreferences: preferences } : guest,
                  ),
                }
              : event,
          ),
        );
        updateDietaryPreferencesRow(eventId, user.id, preferences).catch((error: unknown) => {
          reportSupabaseError(error);
          void refetch();
        });
        return;
      }

      setEvents((current) =>
        current.map((event) =>
          event.id === eventId
            ? {
                ...event,
                guests: event.guests.map((guest) =>
                  guest.id === SELF_GUEST_ID ? { ...guest, dietaryPreferences: preferences } : guest,
                ),
              }
            : event,
        ),
      );
    },
    [mode, user, refetch],
  );

  const value = useMemo<EventsContextValue>(
    () => ({
      events,
      hydrated,
      getEvent,
      createEvent,
      updateEvent,
      respondToInvite,
      removeGuest,
      addGuest,
      updateMyDietaryPreferences,
      isOwner,
    }),
    [
      events,
      hydrated,
      getEvent,
      createEvent,
      updateEvent,
      respondToInvite,
      removeGuest,
      addGuest,
      updateMyDietaryPreferences,
      isOwner,
    ],
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents(): EventsContextValue {
  const context = useContext(EventsContext);
  if (context === null) {
    throw new Error('useEvents must be used inside <EventsProvider>');
  }
  return context;
}
