import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { showDialog } from '@/components/ActionSheet';
import {
  bookVenue,
  cancelVenueBooking,
  fetchVenueBooking,
  fetchVenueFollowers,
  saveVenueZones,
  setCheckedIn,
  setVenueFollow,
  type BookVenueInput,
} from '@/data/venueRepository';
import { useAuth } from '@/hooks/useAuth';
import type { VenueZoneInput } from '@/types/venue';
import i18n from '@/utils/i18n';
import { reportSupabaseError, supabaseErrorMessage } from '@/utils/reportError';

/** Booking errors the customer can act on get their own message. */
function reportVenueError(error: unknown): void {
  const message = supabaseErrorMessage(error);
  if (message.includes('zone_full')) {
    showDialog({ title: i18n.t('venue.book.zoneFullTitle'), message: i18n.t('venue.book.zoneFullBody') });
  } else if (message.includes('organizer_cannot_book')) {
    showDialog({ title: i18n.t('venue.book.organizerTitle') });
  } else {
    reportSupabaseError(error);
  }
}

/**
 * Plain react-query hook (no provider). ['venue', eventId] = the booking page
 * data (zones with free spots, lineup, my booking, following); polls every
 * 20s while mounted so free spots stay roughly current. `token` is the public
 * link token when the caller isn't a guest yet.
 */
export function useVenue(eventId: string, token: string | null = null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const queryKey = useMemo(() => ['venue', eventId] as const, [eventId]);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchVenueBooking(eventId, token),
    enabled: eventId.length > 0 && userId !== null,
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
    // The booking is an event_guests row: the events list (Home, guest list) changes too.
    void queryClient.invalidateQueries({ queryKey: ['events', userId] });
  }, [queryClient, queryKey, userId]);

  const bookMutation = useMutation({
    mutationFn: (input: Omit<BookVenueInput, 'eventId' | 'token'>) => bookVenue({ ...input, eventId, token }),
    onSuccess: refreshAll,
    onError: reportVenueError,
  });

  const cancelMutation = useMutation({
    mutationFn: (guestId: string) => cancelVenueBooking(guestId),
    onSuccess: refreshAll,
    onError: reportSupabaseError,
  });

  const followMutation = useMutation({
    mutationFn: (vars: { agencyId: string; follow: boolean }) => setVenueFollow(vars.agencyId, vars.follow, userId ?? ''),
    onSettled: () => void queryClient.invalidateQueries({ queryKey }),
    onError: reportSupabaseError,
  });

  const zonesMutation = useMutation({
    mutationFn: (zones: VenueZoneInput[]) => saveVenueZones(eventId, zones),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
    onError: reportSupabaseError,
  });

  const checkInMutation = useMutation({
    mutationFn: (vars: { guestId: string; checkedIn: boolean }) => setCheckedIn(vars.guestId, vars.checkedIn),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['events', userId] }),
    onError: reportSupabaseError,
  });

  return {
    venue: query.data ?? null,
    loading: query.isLoading,
    notFound: query.isSuccess && query.data === null,
    book: bookMutation.mutateAsync,
    booking: bookMutation.isPending,
    cancel: cancelMutation.mutate,
    setFollow: followMutation.mutate,
    saveZones: zonesMutation.mutateAsync,
    setCheckedIn: checkInMutation.mutate,
  };
}

/** Venue owner: customers who agreed to get invitations. */
export function useVenueFollowers(agencyId: string | null) {
  const query = useQuery({
    queryKey: ['venueFollowers', agencyId],
    queryFn: () => fetchVenueFollowers(agencyId as string),
    enabled: agencyId !== null,
    staleTime: 60_000,
  });
  return { followers: query.data ?? [], loading: query.isLoading };
}
