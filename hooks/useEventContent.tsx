import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { localRepository, type Actor } from '@/data/eventContentRepository';
import { remoteRepository } from '@/data/remoteEventContentRepository';
import { useAuth } from '@/hooks/useAuth';
import type {
  Accommodation,
  ContributionsContent,
  DetailsContent,
  EventContent,
  ReactionType,
  ScheduleItem,
  SeatingTable,
  SocialContent,
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

/** Which of the three cached slices a given remote write should invalidate. */
type ContentCategory = 'social' | 'details' | 'contributions';

/**
 * Per-event content — no Context/Provider anymore (see useEvents.tsx for the
 * same change and why it's safe: the TanStack Query cache is already global,
 * so screens outside the guest tabs, e.g. edit-event/schedule/venue/fund/
 * post-moment, share the same cached content as the tabs without needing a
 * store mounted above them).
 *
 * Three independent queries, not one, so each data-freshness category can
 * have its own staleTime — see the comment above each useQuery call below.
 * `content` is still the single merged EventContent every screen has always
 * read; only the caching underneath it is split.
 */
export function useEventContent(eventId: string) {
  const { user, mode } = useAuth();
  const queryClient = useQueryClient();

  const socialKey = useMemo(() => ['eventContent', 'social', mode, eventId] as const, [mode, eventId]);
  const detailsKey = useMemo(() => ['eventContent', 'details', mode, eventId] as const, [mode, eventId]);
  const contributionsKey = useMemo(
    () => ['eventContent', 'contributions', mode, eventId] as const,
    [mode, eventId],
  );

  const socialQuery = useQuery({
    queryKey: socialKey,
    queryFn: () => (mode === 'supabase' ? remoteRepository.loadSocial(eventId) : localRepository.loadSocial(eventId)),
    enabled: eventId.length > 0,
    /**
     * Moments, reactions, messages, photos — the "would be Realtime-backed"
     * category (Infinity staleTime, cache updated by a subscription event
     * rather than a timer). No Realtime subscriptions exist in this codebase
     * (see CLAUDE.md §7), so Infinity here would mean another guest's
     * message/photo/moment never appears until this device's own next
     * mutation invalidates the key — a real regression, not a tuning win.
     * Using the same 30s + explicit-invalidation treatment as category 3
     * instead, until Realtime is actually built.
     */
    staleTime: 30_000,
  });

  const detailsQuery = useQuery({
    queryKey: detailsKey,
    queryFn: () => (mode === 'supabase' ? remoteRepository.loadDetails(eventId) : localRepository.loadDetails(eventId)),
    enabled: eventId.length > 0,
    // Schedule, venue, menu, seating, accommodations, vendors, fund settings —
    // owner-edited, rarely changing. Every mutation that touches this data
    // already invalidates this key explicitly, so a longer staleTime here
    // only affects how soon *other* devices/sessions notice an edit, not the
    // editor's own screen.
    staleTime: 3 * 60_000,
  });

  const contributionsQuery = useQuery({
    queryKey: contributionsKey,
    queryFn: () =>
      mode === 'supabase' ? remoteRepository.loadContributions(eventId) : localRepository.loadContributions(eventId),
    enabled: eventId.length > 0,
    // User-action-driven list, same category as the guest list — see
    // hooks/useEvents.tsx. Nothing writes contributions client-side today
    // (no Stripe integration — see CLAUDE.md §7), so this is mostly future-
    // proofing: once a webhook can write here, staleTime is the safety net
    // that surfaces a contribution made from another device without a
    // client-side mutation to invalidate on this device's behalf.
    staleTime: 30_000,
  });

  const content: EventContent | null =
    socialQuery.data !== undefined && detailsQuery.data !== undefined && contributionsQuery.data !== undefined
      ? { ...socialQuery.data, ...detailsQuery.data, ...contributionsQuery.data }
      : null;

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

  /** Local mode only — direct, synchronous cache patches (no server round trip). */
  const updateSocial = useCallback(
    (updater: (current: SocialContent) => SocialContent) => {
      queryClient.setQueryData<SocialContent>(socialKey, (current) =>
        current === undefined ? current : updater(current),
      );
    },
    [queryClient, socialKey],
  );
  const updateDetails = useCallback(
    (updater: (current: DetailsContent) => DetailsContent) => {
      queryClient.setQueryData<DetailsContent>(detailsKey, (current) =>
        current === undefined ? current : updater(current),
      );
    },
    [queryClient, detailsKey],
  );
  const updateContributions = useCallback(
    (updater: (current: ContributionsContent) => ContributionsContent) => {
      queryClient.setQueryData<ContributionsContent>(contributionsKey, (current) =>
        current === undefined ? current : updater(current),
      );
    },
    [queryClient, contributionsKey],
  );

  /**
   * Supabase mode only. Replaces the old runRemote(mutate().then(refreshContent))
   * pattern: invalidateQueries marks the affected category stale and triggers
   * a refetch for every mounted observer of that key, instead of one manual
   * reload of the whole (now-split) content bag. `category` picks which of
   * the three keys actually needs to refetch, so e.g. saving a schedule item
   * never invalidates (and re-fetches) messages/photos/moments.
   */
  const remoteMutation = useMutation({
    mutationFn: ({ write }: { write: () => Promise<void>; category: ContentCategory }) => write(),
    onSuccess: (_result, { category }) => {
      const key = category === 'social' ? socialKey : category === 'details' ? detailsKey : contributionsKey;
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (error: unknown) => reportSupabaseError(error),
  });
  const runRemote = useCallback(
    (write: () => Promise<void>, category: ContentCategory) => remoteMutation.mutate({ write, category }),
    [remoteMutation],
  );

  const actions = useMemo(
    () => ({
      toggleReaction: (momentId: string, reaction: ReactionType) => {
        if (mode === 'supabase') {
          const already = hasReacted(momentId, reaction);
          runRemote(
            () =>
              already
                ? remoteRepository.removeReaction(momentId, reaction, actor)
                : remoteRepository.addReaction(momentId, reaction, actor),
            'social',
          );
          return;
        }

        updateSocial((current) => {
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
          runRemote(() => remoteRepository.sendMessage(eventId, trimmed, actor), 'social');
          return;
        }

        updateSocial((current) => ({
          ...current,
          messages: [...current.messages, localRepository.sendMessage(eventId, trimmed, actor)],
        }));
      },

      addPhoto: (url: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.addPhoto(eventId, url, actor), 'social');
          return;
        }

        updateSocial((current) => ({
          ...current,
          photos: [localRepository.addPhoto(eventId, url, actor), ...current.photos],
        }));
      },

      /** Local-only: nothing writes contributions client-side even against Supabase —
       * the schema has no insert policy on purpose, contributions land via a Stripe
       * webhook using the service role. Unused today since checkout is a stub. */
      contribute: (amount: number) =>
        updateDetails((current) =>
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
          runRemote(() => remoteRepository.createMoment(eventId, title, photoUrl, actor), 'social');
          return;
        }

        updateSocial((current) => ({
          ...current,
          moments: [
            localRepository.createMoment(eventId, title, photoUrl, actor),
            ...current.moments,
          ],
        }));
      },

      saveFund: (input: FundInput) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.saveFund(eventId, input, content?.fund?.id ?? null), 'details');
          return;
        }

        updateDetails((current) => ({
          ...current,
          fund:
            current.fund === null
              ? localRepository.createFund(eventId, input)
              : { ...current.fund, ...input },
        }));
      },

      deleteFund: () => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteFund(eventId), 'details');
          return;
        }

        updateDetails((current) => ({ ...current, fund: null }));
        updateContributions(() => ({ contributions: [] }));
      },

      saveScheduleItem: (item: ScheduleItemInput) => {
        if (mode === 'supabase') {
          runRemote(
            () => remoteRepository.saveScheduleItem(eventId, item, content?.schedule.length ?? 0),
            'details',
          );
          return;
        }

        updateDetails((current) => {
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
          runRemote(() => remoteRepository.deleteScheduleItem(itemId), 'details');
          return;
        }

        updateDetails((current) => ({
          ...current,
          schedule: current.schedule.filter((item) => item.id !== itemId),
        }));
      },

      deleteMoment: (momentId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteMoment(momentId), 'social');
          return;
        }

        updateSocial((current) => ({
          ...current,
          moments: current.moments.filter((moment) => moment.id !== momentId),
          reactions: current.reactions.filter((entry) => entry.moment_id !== momentId),
        }));
      },

      deleteMessage: (messageId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteMessage(messageId), 'social');
          return;
        }

        updateSocial((current) => ({
          ...current,
          messages: current.messages.filter((message) => message.id !== messageId),
        }));
      },

      deletePhoto: (photoId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deletePhoto(photoId), 'social');
          return;
        }

        updateSocial((current) => ({
          ...current,
          photos: current.photos.filter((photo) => photo.id !== photoId),
        }));
      },

      updateVenue: (venue: Venue) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.updateVenue(venue), 'details');
          return;
        }

        updateDetails((current) => ({ ...current, venue }));
      },

      saveMenu: (input: MenuInput) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.saveMenu(eventId, input), 'details');
          return;
        }

        updateDetails((current) => ({ ...current, menu: { event_id: eventId, ...input } }));
      },

      saveSeatingTable: (item: SeatingTableInput) => {
        if (mode === 'supabase') {
          runRemote(
            () => remoteRepository.saveSeatingTable(eventId, item, content?.seatingTables.length ?? 0),
            'details',
          );
          return;
        }

        updateDetails((current) => {
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
          runRemote(() => remoteRepository.deleteSeatingTable(tableId), 'details');
          return;
        }

        updateDetails((current) => ({
          ...current,
          seatingTables: current.seatingTables.filter((table) => table.id !== tableId),
        }));
      },

      saveAccommodation: (item: AccommodationInput) => {
        if (mode === 'supabase') {
          runRemote(
            () => remoteRepository.saveAccommodation(eventId, item, content?.accommodations.length ?? 0),
            'details',
          );
          return;
        }

        updateDetails((current) => {
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
          runRemote(() => remoteRepository.deleteAccommodation(accommodationId), 'details');
          return;
        }

        updateDetails((current) => ({
          ...current,
          accommodations: current.accommodations.filter((entry) => entry.id !== accommodationId),
        }));
      },

      saveVendor: (item: VendorInput) => {
        if (mode === 'supabase') {
          runRemote(
            () => remoteRepository.saveVendor(eventId, item, content?.vendors.length ?? 0),
            'details',
          );
          return;
        }

        updateDetails((current) => {
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
          runRemote(() => remoteRepository.deleteVendor(vendorId), 'details');
          return;
        }

        updateDetails((current) => ({
          ...current,
          vendors: current.vendors.filter((vendor) => vendor.id !== vendorId),
        }));
      },
    }),
    [eventId, updateSocial, updateDetails, updateContributions, actor, mode, hasReacted, runRemote, content],
  );

  return { content, hasReacted, reactionCount, ...actions };
}
