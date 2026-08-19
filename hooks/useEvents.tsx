import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import {
  fetchEventById,
  fetchEvents,
  insertEvent,
  insertGuestInvite,
  insertGuestInvitePhone,
  removeGuestRow,
  respondToInviteRow,
  updateDietaryPreferencesRow,
  updateEventRow,
} from '@/data/eventsRepository';
import { useAgency } from '@/hooks/useAgency';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { AppEvent, EventDraft, RsvpStatus } from '@/types/event';
import { reportSupabaseError } from '@/utils/reportError';

interface EventsResult {
  events: AppEvent[];
  /** False until the initial Supabase fetch completes, so lists don't flash empty. */
  hydrated: boolean;
  getEvent: (id: string | undefined) => AppEvent | undefined;
  createEvent: (draft: EventDraft) => Promise<AppEvent>;
  updateEvent: (eventId: string, patch: Partial<Omit<AppEvent, 'id' | 'owner_id' | 'agency_id'>>) => Promise<void>;
  respondToInvite: (eventId: string, status: Exclude<RsvpStatus, 'pending'>) => void;
  removeGuest: (eventId: string, guestId: string) => void;
  addGuest: (eventId: string, email: string, name: string) => Promise<void>;
  addGuestByPhone: (eventId: string, phone: string, name: string) => Promise<void>;
  /** A signed-in non-organizer's own preference — no-op for an owner (no guest row to write to). */
  updateMyDietaryPreferences: (eventId: string, preferences: string[]) => void;
  isOwner: (event: AppEvent | undefined) => boolean;
}

/**
 * The events resource — no Context/Provider anymore. The TanStack Query cache
 * (global, via the root QueryClientProvider) is the shared store, so any
 * component calling this hook sees the same data regardless of where it sits
 * in the tree, and a mutation's invalidateQueries() reaches every consumer.
 */
export function useEvents(): EventsResult {
  const { user } = useAuth();
  const { agency } = useAgency();
  // Prefer the real name over user.label's email/phone fallback wherever a
  // guest's own event_guests row is written — this is the "who's attending"
  // case flagged for the name feature; the auto-link backfill trigger
  // (20260820000001_user_names.sql) already covers the invited-by-email/phone
  // side, this covers the "responds before ever being explicitly invited" side.
  const { displayName } = useUserProfile();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = useMemo(() => ['events', userId] as const, [userId]);

  const eventsQuery = useQuery({
    queryKey,
    queryFn: () => fetchEvents(),
    enabled: userId !== null,
    /**
     * Category 3 (user-action-driven list): each AppEvent row bundles the
     * event's own rarely-changing fields (name/date/location — category 2 on
     * their own) together with its `guests` array (rsvp_status, dietary
     * preferences — squarely category 3). They're one row, not two queries,
     * so this uses the shorter, guest-list-appropriate staleTime rather than
     * category 2's 3 minutes — every mutation that touches this key
     * (createEvent, updateEvent, removeGuest, addGuest, respondToInvite,
     * updateMyDietaryPreferences) already calls invalidateQueries in
     * onSuccess too, so this staleTime is the drift safety net, not the
     * primary update path.
     */
    staleTime: 30_000,
  });

  const events = eventsQuery.data ?? [];
  // No session has nothing to fetch — that's a settled state, not a pending
  // one, so it counts as hydrated immediately.
  const hydrated = userId === null ? true : eventsQuery.isFetched;

  const getEvent = useCallback(
    (id: string | undefined) => (id === undefined ? undefined : events.find((e) => e.id === id)),
    [events],
  );

  const createEventMutation = useMutation({
    // Auto-tags the event to the creator's agency, if they own one — see
    // supabase/migrations/20260813000001_agencies.sql's note on why this is
    // just a dashboard-filtering tag, not a new access-control boundary; an
    // individual user (no agency row) passes null, unaffected.
    mutationFn: (draft: EventDraft) => insertEvent(draft, user?.id ?? '', agency?.id ?? null),
    onSuccess: (event) => {
      queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) => [event, ...current]);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const createEvent = useCallback(
    (draft: EventDraft) => createEventMutation.mutateAsync(draft),
    [createEventMutation],
  );

  const updateEventMutation = useMutation({
    mutationFn: (vars: { eventId: string; patch: Partial<Omit<AppEvent, 'id' | 'owner_id' | 'agency_id'>> }) =>
      updateEventRow(vars.eventId, vars.patch),
    onSuccess: (_result, { eventId, patch }) => {
      queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) =>
        current.map((event) => (event.id === eventId ? { ...event, ...patch } : event)),
      );
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const updateEvent = useCallback(
    async (eventId: string, patch: Partial<Omit<AppEvent, 'id' | 'owner_id' | 'agency_id'>>): Promise<void> => {
      await updateEventMutation.mutateAsync({ eventId, patch });
    },
    [updateEventMutation],
  );

  const removeGuestMutation = useMutation({
    mutationFn: ({ guestId }: { eventId: string; guestId: string }) => removeGuestRow(guestId),
    onMutate: ({ eventId, guestId }) => {
      queryClient.setQueryData<AppEvent[]>(queryKey, (current = []) =>
        current.map((event) =>
          event.id === eventId
            ? { ...event, guests: event.guests.filter((guest) => guest.id !== guestId) }
            : event,
        ),
      );
    },
    onError: (error) => {
      reportSupabaseError(error);
      void queryClient.invalidateQueries({ queryKey });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
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

  /** Phone equivalent of addGuestMutation above — identical refetch-single-
   * event shape, same reasoning: the auto-link trigger may have linked
   * guest_user_id server-side and there's no way to know ahead of the round
   * trip. */
  const addGuestByPhoneMutation = useMutation({
    mutationFn: async (vars: { eventId: string; phone: string; name: string }) => {
      await insertGuestInvitePhone(vars.eventId, vars.phone, vars.name);
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
  const addGuestByPhone = useCallback(
    async (eventId: string, phone: string, name: string): Promise<void> => {
      await addGuestByPhoneMutation.mutateAsync({ eventId, phone, name });
    },
    [addGuestByPhoneMutation],
  );

  const isOwner = useCallback(
    (event: AppEvent | undefined) => event !== undefined && user !== null && event.owner_id === user.id,
    [user],
  );

  const respondToInviteMutation = useMutation({
    mutationFn: (vars: { eventId: string; status: Exclude<RsvpStatus, 'pending'> }) => {
      if (user === null) throw new Error('Not signed in.');
      return respondToInviteRow(vars.eventId, user.id, displayName ?? user.label, vars.status);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: (error) => reportSupabaseError(error),
  });
  const respondToInvite = useCallback(
    (eventId: string, status: Exclude<RsvpStatus, 'pending'>) =>
      respondToInviteMutation.mutate({ eventId, status }),
    [respondToInviteMutation],
  );

  const updateDietaryMutation = useMutation({
    mutationFn: (vars: { eventId: string; preferences: string[] }) => {
      if (user === null) throw new Error('Not signed in.');
      return updateDietaryPreferencesRow(vars.eventId, user.id, vars.preferences);
    },
    onMutate: ({ eventId, preferences }) => {
      // Optimistic: RLS already limits a non-organizer's event.guests to just
      // their own row, so index 0 is "my" row — same convention used
      // throughout (myRsvp, myInvitations).
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
    },
    // The optimistic onMutate patch above already covers the common case
    // instantly, but this still confirms against the server on success — a
    // stale RLS-rejected write would otherwise look applied locally forever
    // with nothing to correct it until the next unrelated refetch.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
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
    addGuestByPhone,
    updateMyDietaryPreferences,
    isOwner,
  };
}
