import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

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

interface EventsResult {
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

/**
 * The events resource — no Context/Provider anymore. The TanStack Query cache
 * (global, via the root QueryClientProvider) is the shared store, so any
 * component calling this hook sees the same data regardless of where it sits
 * in the tree, and a mutation's invalidateQueries() reaches every consumer.
 */
export function useEvents(): EventsResult {
  const { user, mode } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = useMemo(() => ['events', mode, userId] as const, [mode, userId]);

  const eventsQuery = useQuery({
    queryKey,
    queryFn: () => (mode === 'supabase' ? fetchEvents() : loadEvents()),
    enabled: mode === 'local' || userId !== null,
  });

  const events = eventsQuery.data ?? [];
  // Supabase mode with no session has nothing to fetch — that's a settled state,
  // not a pending one, so it counts as hydrated immediately.
  const hydrated = mode === 'supabase' && userId === null ? true : eventsQuery.isFetched;

  /** Local mode's mutations write straight through to AsyncStorage as they land. */
  const setLocalEvents = useCallback(
    (updater: (current: AppEvent[]) => AppEvent[]) => {
      queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) => {
        const next = updater(current);
        void saveEvents(next);
        return next;
      });
    },
    [queryClient, queryKey],
  );

  const getEvent = useCallback(
    (id: string | undefined) => (id === undefined ? undefined : events.find((e) => e.id === id)),
    [events],
  );

  const createEventMutation = useMutation({
    mutationFn: async (draft: EventDraft): Promise<AppEvent> => {
      if (mode === 'supabase') return insertEvent(draft, user?.id ?? '');
      return {
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
    },
    onSuccess: (event) => {
      if (mode === 'supabase') {
        queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) => [event, ...current]);
        void queryClient.invalidateQueries({ queryKey });
        return;
      }
      setLocalEvents((current) => [event, ...current]);
    },
  });
  const createEvent = useCallback(
    (draft: EventDraft) => createEventMutation.mutateAsync(draft),
    [createEventMutation],
  );

  const updateEventMutation = useMutation({
    mutationFn: async (vars: {
      eventId: string;
      patch: Partial<Omit<AppEvent, 'id' | 'owner_id'>>;
    }) => {
      if (mode === 'supabase') await updateEventRow(vars.eventId, vars.patch);
    },
    onSuccess: (_result, { eventId, patch }) => {
      if (mode === 'supabase') {
        queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) =>
          current.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
        );
        void queryClient.invalidateQueries({ queryKey });
        return;
      }
      setLocalEvents((current) =>
        current.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
      );
    },
  });
  const updateEvent = useCallback(
    async (eventId: string, patch: Partial<Omit<AppEvent, 'id' | 'owner_id'>>): Promise<void> => {
      await updateEventMutation.mutateAsync({ eventId, patch });
    },
    [updateEventMutation],
  );

  const removeGuestMutation = useMutation({
    mutationFn: async ({ guestId }: { eventId: string; guestId: string }) => {
      if (mode === 'supabase') await removeGuestRow(guestId);
    },
    onMutate: ({ eventId, guestId }) => {
      const strip = (current: AppEvent[]) =>
        current.map((event) =>
          event.id === eventId
            ? { ...event, guests: event.guests.filter((guest) => guest.id !== guestId) }
            : event,
        );
      if (mode === 'supabase') {
        queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) => strip(current));
        return;
      }
      setLocalEvents(strip);
    },
    onError: (error) => {
      if (mode !== 'supabase') return;
      reportSupabaseError(error);
      void queryClient.invalidateQueries({ queryKey });
    },
    onSuccess: () => {
      if (mode === 'supabase') void queryClient.invalidateQueries({ queryKey });
    },
  });
  const removeGuest = useCallback(
    (eventId: string, guestId: string) => removeGuestMutation.mutate({ eventId, guestId }),
    [removeGuestMutation],
  );

  /**
   * Refetches the single event after insert rather than patching optimistically:
   * the on_event_guest_insert trigger may have auto-linked guest_user_id server-
   * side, and there's no way to know that outcome ahead of the round trip.
   */
  const addGuestMutation = useMutation({
    mutationFn: async (vars: { eventId: string; email: string; name: string }) => {
      await insertGuestInvite(vars.eventId, vars.email, vars.name);
      return fetchEventById(vars.eventId);
    },
    onSuccess: (fresh) => {
      if (fresh === null) return;
      queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) =>
        current.map((event) => (event.id === fresh.id ? fresh : event)),
      );
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const addGuest = useCallback(
    async (eventId: string, email: string, name: string): Promise<void> => {
      await addGuestMutation.mutateAsync({ eventId, email, name });
    },
    [addGuestMutation],
  );

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

  const respondToInviteMutation = useMutation({
    mutationFn: async (vars: { eventId: string; status: Exclude<RsvpStatus, 'pending'> }) => {
      if (mode === 'supabase' && user !== null) {
        await respondToInviteRow(vars.eventId, user.id, user.label, vars.status);
      }
    },
    onSuccess: (_result, { eventId, status }) => {
      if (mode === 'supabase' && user !== null) {
        void queryClient.invalidateQueries({ queryKey });
        return;
      }

      setLocalEvents((current) =>
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
    onError: (error) => {
      if (mode === 'supabase' && user !== null) reportSupabaseError(error);
    },
  });
  const respondToInvite = useCallback(
    (eventId: string, status: Exclude<RsvpStatus, 'pending'>) =>
      respondToInviteMutation.mutate({ eventId, status }),
    [respondToInviteMutation],
  );

  const updateDietaryMutation = useMutation({
    mutationFn: async (vars: { eventId: string; preferences: string[] }) => {
      if (mode === 'supabase' && user !== null) {
        await updateDietaryPreferencesRow(vars.eventId, user.id, vars.preferences);
      }
    },
    onMutate: ({ eventId, preferences }) => {
      // Optimistic: RLS already limits a non-organizer's event.guests to just
      // their own row, so index 0 is "my" row — same convention used
      // throughout (myRsvp, myInvitations).
      if (mode === 'supabase' && user !== null) {
        queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) =>
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
        return;
      }

      setLocalEvents((current) =>
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
    onError: (error) => {
      if (mode !== 'supabase' || user === null) return;
      reportSupabaseError(error);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const updateMyDietaryPreferences = useCallback(
    (eventId: string, preferences: string[]) =>
      updateDietaryMutation.mutate({ eventId, preferences }),
    [updateDietaryMutation],
  );

  return {
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
  };
}
