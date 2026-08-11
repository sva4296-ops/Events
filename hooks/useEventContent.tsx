import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { localRepository, type Actor } from '@/data/eventContentRepository';
import { remoteRepository } from '@/data/remoteEventContentRepository';
import { useAuth } from '@/hooks/useAuth';
import type {
  Accommodation,
  EventContent,
  ReactionType,
  ScheduleItem,
  SeatingTable,
  Vendor,
  Venue,
} from '@/types/guest';
import { createId } from '@/utils/id';
import { reportSupabaseError } from '@/utils/reportError';

export interface FundInput {
  title: string;
  description: string;
  target_amount: number;
  currency: string;
}

export interface ScheduleItemInput {
  id: string | null;
  time: string;
  title: string;
  location: string;
}

export interface MenuInput {
  starter: string;
  main: string;
  dessert: string;
}

export interface SeatingTableInput {
  id: string | null;
  name: string;
  label: string;
  seat_count: number;
}

export interface AccommodationInput {
  id: string | null;
  name: string;
  detail_line: string;
  price_line: string;
}

export interface VendorInput {
  id: string | null;
  name: string;
  category: string;
  handle: string;
  external_url: string;
}

/**
 * Per-event content — no Context/Provider anymore (see useEvents.tsx for the
 * same change and why it's safe: the TanStack Query cache is already global,
 * so screens outside the guest tabs, e.g. edit-event/schedule/venue/fund/
 * post-moment, share the same cached content as the tabs without needing a
 * store mounted above them).
 */
export function useEventContent(eventId: string) {
  const { user, mode } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['eventContent', mode, eventId] as const, [mode, eventId]);

  const contentQuery = useQuery({
    queryKey,
    queryFn: () => (mode === 'supabase' ? remoteRepository.load(eventId) : localRepository.load(eventId)),
    enabled: eventId.length > 0,
  });

  const content = contentQuery.data ?? null;

  const actor: Actor = useMemo(
    () => ({ id: user?.id ?? 'anonymous', label: user?.email ?? 'Tu' }),
    [user],
  );

  const hasReacted = useCallback(
    (momentId: string, reaction: ReactionType) =>
      content?.reactions.some(
        (entry) =>
          entry.moment_id === momentId &&
          entry.reaction_type === reaction &&
          entry.user_id === actor.id,
      ) ?? false,
    [content, actor],
  );

  const reactionCount = useCallback(
    (momentId: string, reaction: ReactionType) =>
      content?.reactions.filter(
        (entry) => entry.moment_id === momentId && entry.reaction_type === reaction,
      ).length ?? 0,
    [content],
  );

  /** Local mode only — direct, synchronous cache patch (no server round trip). */
  const updateLocal = useCallback(
    (updater: (current: EventContent) => EventContent) => {
      queryClient.setQueryData<EventContent>(queryKey, (current) =>
        current === undefined ? current : updater(current),
      );
    },
    [queryClient, queryKey],
  );

  /**
   * Supabase mode only. Replaces the old runRemote(mutate().then(refreshContent))
   * pattern: invalidateQueries marks this event's content stale and triggers a
   * refetch for every mounted observer of this key, instead of one manual reload.
   */
  const remoteMutation = useMutation({
    mutationFn: (write: () => Promise<void>) => write(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => reportSupabaseError(error),
  });
  const runRemote = useCallback(
    (write: () => Promise<void>) => remoteMutation.mutate(write),
    [remoteMutation],
  );

  const actions = useMemo(
    () => ({
      toggleReaction: (momentId: string, reaction: ReactionType) => {
        if (mode === 'supabase') {
          const already = hasReacted(momentId, reaction);
          runRemote(() =>
            already
              ? remoteRepository.removeReaction(momentId, reaction, actor)
              : remoteRepository.addReaction(momentId, reaction, actor),
          );
          return;
        }

        updateLocal((current) => {
          const existing = current.reactions.find(
            (entry) =>
              entry.moment_id === momentId &&
              entry.reaction_type === reaction &&
              entry.user_id === actor.id,
          );
          return existing !== undefined
            ? { ...current, reactions: current.reactions.filter((e) => e.id !== existing.id) }
            : {
                ...current,
                reactions: [
                  ...current.reactions,
                  localRepository.toggleReaction(momentId, reaction, actor),
                ],
              };
        });
      },

      sendMessage: (text: string) => {
        const trimmed = text.trim();
        if (trimmed.length === 0) return;

        if (mode === 'supabase') {
          runRemote(() => remoteRepository.sendMessage(eventId, trimmed, actor));
          return;
        }

        updateLocal((current) => ({
          ...current,
          messages: [...current.messages, localRepository.sendMessage(eventId, trimmed, actor)],
        }));
      },

      addPhoto: (url: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.addPhoto(eventId, url, actor));
          return;
        }

        updateLocal((current) => ({
          ...current,
          photos: [localRepository.addPhoto(eventId, url, actor), ...current.photos],
        }));
      },

      /** Local-only: nothing writes contributions client-side even against Supabase —
       * the schema has no insert policy on purpose, contributions land via a Stripe
       * webhook using the service role. Unused today since checkout is a stub. */
      contribute: (amount: number) =>
        updateLocal((current) =>
          current.fund === null
            ? current
            : {
                ...current,
                fund: { ...current.fund, current_amount: current.fund.current_amount + amount },
              },
        ),

      /** Optimistic prepend in local mode; a cache invalidation (refetch) in Supabase mode. */
      addMoment: (title: string, photoUrl: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.createMoment(eventId, title, photoUrl, actor));
          return;
        }

        updateLocal((current) => ({
          ...current,
          moments: [
            localRepository.createMoment(eventId, title, photoUrl, actor),
            ...current.moments,
          ],
        }));
      },

      saveFund: (input: FundInput) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.saveFund(eventId, input, content?.fund?.id ?? null));
          return;
        }

        updateLocal((current) => ({
          ...current,
          fund:
            current.fund === null
              ? localRepository.createFund(eventId, input)
              : { ...current.fund, ...input },
        }));
      },

      deleteFund: () => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteFund(eventId));
          return;
        }

        updateLocal((current) => ({ ...current, fund: null, contributions: [] }));
      },

      saveScheduleItem: (item: ScheduleItemInput) => {
        if (mode === 'supabase') {
          runRemote(() =>
            remoteRepository.saveScheduleItem(eventId, item, content?.schedule.length ?? 0),
          );
          return;
        }

        updateLocal((current) => {
          const id = item.id ?? createId();
          const next: ScheduleItem = {
            id,
            event_id: eventId,
            time: item.time,
            title: item.title,
            location: item.location,
          };
          const schedule =
            item.id === null
              ? [...current.schedule, next]
              : current.schedule.map((entry) => (entry.id === id ? next : entry));
          return { ...current, schedule };
        });
      },

      deleteScheduleItem: (itemId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteScheduleItem(itemId));
          return;
        }

        updateLocal((current) => ({
          ...current,
          schedule: current.schedule.filter((item) => item.id !== itemId),
        }));
      },

      deleteMoment: (momentId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteMoment(momentId));
          return;
        }

        updateLocal((current) => ({
          ...current,
          moments: current.moments.filter((moment) => moment.id !== momentId),
          reactions: current.reactions.filter((entry) => entry.moment_id !== momentId),
        }));
      },

      deleteMessage: (messageId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteMessage(messageId));
          return;
        }

        updateLocal((current) => ({
          ...current,
          messages: current.messages.filter((message) => message.id !== messageId),
        }));
      },

      deletePhoto: (photoId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deletePhoto(photoId));
          return;
        }

        updateLocal((current) => ({
          ...current,
          photos: current.photos.filter((photo) => photo.id !== photoId),
        }));
      },

      updateVenue: (venue: Venue) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.updateVenue(venue));
          return;
        }

        updateLocal((current) => ({ ...current, venue }));
      },

      saveMenu: (input: MenuInput) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.saveMenu(eventId, input));
          return;
        }

        updateLocal((current) => ({ ...current, menu: { event_id: eventId, ...input } }));
      },

      saveSeatingTable: (item: SeatingTableInput) => {
        if (mode === 'supabase') {
          runRemote(() =>
            remoteRepository.saveSeatingTable(eventId, item, content?.seatingTables.length ?? 0),
          );
          return;
        }

        updateLocal((current) => {
          const id = item.id ?? createId();
          const next: SeatingTable = {
            id,
            event_id: eventId,
            name: item.name,
            label: item.label,
            seat_count: item.seat_count,
          };
          const seatingTables =
            item.id === null
              ? [...current.seatingTables, next]
              : current.seatingTables.map((entry) => (entry.id === id ? next : entry));
          return { ...current, seatingTables };
        });
      },

      deleteSeatingTable: (tableId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteSeatingTable(tableId));
          return;
        }

        updateLocal((current) => ({
          ...current,
          seatingTables: current.seatingTables.filter((table) => table.id !== tableId),
        }));
      },

      saveAccommodation: (item: AccommodationInput) => {
        if (mode === 'supabase') {
          runRemote(() =>
            remoteRepository.saveAccommodation(eventId, item, content?.accommodations.length ?? 0),
          );
          return;
        }

        updateLocal((current) => {
          const id = item.id ?? createId();
          const next: Accommodation = {
            id,
            event_id: eventId,
            name: item.name,
            detail_line: item.detail_line,
            price_line: item.price_line,
          };
          const accommodations =
            item.id === null
              ? [...current.accommodations, next]
              : current.accommodations.map((entry) => (entry.id === id ? next : entry));
          return { ...current, accommodations };
        });
      },

      deleteAccommodation: (accommodationId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteAccommodation(accommodationId));
          return;
        }

        updateLocal((current) => ({
          ...current,
          accommodations: current.accommodations.filter((entry) => entry.id !== accommodationId),
        }));
      },

      saveVendor: (item: VendorInput) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.saveVendor(eventId, item, content?.vendors.length ?? 0));
          return;
        }

        updateLocal((current) => {
          const id = item.id ?? createId();
          const next: Vendor = {
            id,
            event_id: eventId,
            name: item.name,
            category: item.category,
            handle: item.handle,
            external_url: item.external_url,
          };
          const vendors =
            item.id === null
              ? [...current.vendors, next]
              : current.vendors.map((entry) => (entry.id === id ? next : entry));
          return { ...current, vendors };
        });
      },

      deleteVendor: (vendorId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteVendor(vendorId));
          return;
        }

        updateLocal((current) => ({
          ...current,
          vendors: current.vendors.filter((vendor) => vendor.id !== vendorId),
        }));
      },
    }),
    [eventId, updateLocal, actor, mode, hasReacted, runRemote, content],
  );

  return { content, hasReacted, reactionCount, ...actions };
}
