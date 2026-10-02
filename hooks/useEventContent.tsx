import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { remoteRepository, type Actor } from '@/data/remoteEventContentRepository';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import type { DetailsContent, EventContent, ReactionType, TableShape, Venue } from '@/types/guest';
import { processMomentPhoto, processPhotoVersions, type PickedPhoto } from '@/utils/imageProcessing';
import { reportSupabaseError } from '@/utils/reportError';
import { generateId } from '@/utils/uuid';

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

/** A course photo in the editor: keep the saved one, upload a new pick, or none. */
export type MenuCoursePhotoInput = { kind: 'keep'; path: string } | { kind: 'new'; picked: PickedPhoto } | null;

export interface MenuOptionInput {
  id: string | null;
  name: string;
  courses: { name: string; dish: string; photo: MenuCoursePhotoInput }[];
}

export interface SeatingTableInput {
  id: string | null;
  name: string;
  label: string;
  seat_count: number;
  shape: TableShape;
  /** Confirmed guests assigned to this table — see app/table/[id].tsx. */
  /** null: leave seat assignments as they are (the restaurant role). */
  guestIds: string[] | null;
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
  const { user } = useAuth();
  const { displayName } = useUserProfile();
  const queryClient = useQueryClient();

  const socialKey = useMemo(() => ['eventContent', 'social', eventId] as const, [eventId]);
  const detailsKey = useMemo(() => ['eventContent', 'details', eventId] as const, [eventId]);
  const contributionsKey = useMemo(
    () => ['eventContent', 'contributions', eventId] as const,
    [eventId],
  );

  const socialQuery = useQuery({
    queryKey: socialKey,
    queryFn: () => remoteRepository.loadSocial(eventId),
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
    queryFn: () => remoteRepository.loadDetails(eventId),
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
    queryFn: () => remoteRepository.loadContributions(eventId),
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

  // displayName first — the real name once set; user.email was the only
  // fallback here before (not even user.phone), fixed as part of the same
  // change. Attribution self-selects display_name fresh at write time anyway
  // (see remoteEventContentRepository.ts), so this only matters as the
  // fallback-of-a-fallback when that self-select comes back empty.
  const actor: Actor = useMemo(
    () => ({ id: user?.id ?? 'anonymous', label: displayName ?? user?.email ?? user?.phone ?? 'Tu' }),
    [user, displayName],
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

  /**
   * Replaces the old runRemote(mutate().then(refreshContent)) pattern:
   * invalidateQueries marks the affected category stale and triggers a
   * refetch for every mounted observer of that key, instead of one manual
   * reload of the whole (now-split) content bag. `category` picks which of
   * the three keys actually needs to refetch, so e.g. saving a schedule item
   * never invalidates (and re-fetches) messages/photos/moments.
   */
  const remoteMutation = useMutation({
    mutationFn: ({
      write,
    }: {
      write: () => Promise<void>;
      category: ContentCategory;
      extraKeys?: readonly QueryKey[];
    }) => write(),
    // Deliberately mutation-level, not a per-call mutate(vars, { onSuccess })
    // option: the screens that call runRemote (e.g. app/table/[id].tsx's
    // save()) navigate away immediately after calling the action, often
    // before the write has resolved. TanStack Query's MutationObserver only
    // invokes per-call mutate() callbacks while the owning component is still
    // subscribed (hasListeners()) — they're silently dropped once it unmounts.
    // Callbacks defined here, on useMutation itself, are bound to the
    // Mutation object in the MutationCache instead, so they always fire once
    // the write settles, regardless of whether anything is still mounted to
    // hear about it. extraKeys (e.g. saveSeatingTable's cross-cache 'events'
    // invalidation) rides along in the mutation variables for this reason.
    onSuccess: (_result, { category, extraKeys }) => {
      const key = category === 'social' ? socialKey : category === 'details' ? detailsKey : contributionsKey;
      void queryClient.invalidateQueries({ queryKey: key });
      extraKeys?.forEach((extraKey) => void queryClient.invalidateQueries({ queryKey: extraKey }));
    },
    onError: (error: unknown) => reportSupabaseError(error),
  });
  const runRemote = useCallback(
    (write: () => Promise<void>, category: ContentCategory, extraKeys?: readonly QueryKey[]) =>
      remoteMutation.mutate({ write, category, extraKeys }),
    [remoteMutation],
  );

  const actions = useMemo(
    () => ({
      toggleReaction: (momentId: string, reaction: ReactionType) => {
        const already = hasReacted(momentId, reaction);
        runRemote(
          () =>
            already
              ? remoteRepository.removeReaction(momentId, reaction, actor)
              : remoteRepository.addReaction(momentId, reaction, actor),
          'social',
        );
      },

      sendMessage: (text: string) => {
        const trimmed = text.trim();
        if (trimmed.length === 0) return;
        runRemote(() => remoteRepository.sendMessage(eventId, trimmed, actor), 'social');
      },

      addPhoto: (photo: PickedPhoto) => {
        runRemote(async () => {
          const photoId = generateId();
          const versions = await processPhotoVersions(photo);
          await remoteRepository.addPhoto(eventId, photoId, versions, actor);
        }, 'social');
      },

      /** Stubbed: the `contributions` table has no client insert policy, on
       * purpose — a contribution is meant to land via a Stripe webhook using
       * the service role, never the client (see CLAUDE.md §3). There is no
       * remote counterpart to call here, so this patches the cache directly;
       * unused today since checkout is still a placeholder. */
      contribute: (amount: number) =>
        queryClient.setQueryData<DetailsContent>(detailsKey, (current) =>
          current === undefined || current.fund === null
            ? current
            : {
                ...current,
                fund: { ...current.fund, current_amount: current.fund.current_amount + amount },
              },
        ),

      addMoment: (title: string, photo: PickedPhoto | null) => {
        runRemote(async () => {
          const momentId = generateId();
          const photoUri = photo === null ? null : await processMomentPhoto(photo);
          await remoteRepository.createMoment(eventId, momentId, title, photoUri, actor);
        }, 'social');
      },

      saveFund: (input: FundInput) => {
        runRemote(() => remoteRepository.saveFund(eventId, input, content?.fund?.id ?? null), 'details');
      },

      deleteFund: () => {
        runRemote(() => remoteRepository.deleteFund(eventId), 'details');
      },

      saveScheduleItem: (item: ScheduleItemInput) => {
        runRemote(
          () => remoteRepository.saveScheduleItem(eventId, item, content?.schedule.length ?? 0),
          'details',
        );
      },

      deleteScheduleItem: (itemId: string) => {
        runRemote(() => remoteRepository.deleteScheduleItem(itemId), 'details');
      },

      deleteMoment: (momentId: string) => {
        runRemote(() => remoteRepository.deleteMoment(eventId, momentId), 'social');
      },

      deleteMessage: (messageId: string) => {
        runRemote(() => remoteRepository.deleteMessage(messageId), 'social');
      },

      deletePhoto: (photoId: string) => {
        runRemote(() => remoteRepository.deletePhoto(eventId, photoId), 'social');
      },

      updateVenue: (venue: Venue) => {
        runRemote(() => remoteRepository.updateVenue(venue), 'details');
      },

      saveMenu: (input: MenuInput) => {
        runRemote(() => remoteRepository.saveMenu(eventId, input), 'details');
      },

      // Uploads new course photos first, saves, then removes photos that were
      // replaced or dropped (best-effort).
      saveMenuOption: (item: MenuOptionInput) => {
        const previousPaths =
          content?.menuOptions
            .find((option) => option.id === item.id)
            ?.courses.flatMap((course) => (course.photo_path !== null ? [course.photo_path] : [])) ?? [];
        runRemote(async () => {
          const courses = await Promise.all(
            item.courses.map(async (course) => {
              let photoPath: string | null = null;
              if (course.photo?.kind === 'keep') photoPath = course.photo.path;
              if (course.photo?.kind === 'new') {
                const resized = await processMomentPhoto(course.photo.picked);
                photoPath = await remoteRepository.uploadMenuPhoto(eventId, generateId(), resized);
              }
              return { name: course.name, dish: course.dish, photo_path: photoPath };
            }),
          );
          await remoteRepository.saveMenuOption(
            eventId,
            { id: item.id, name: item.name, courses },
            content?.menuOptions.length ?? 0,
          );
          const kept = new Set(courses.map((course) => course.photo_path));
          await remoteRepository.removeMenuPhotos(previousPaths.filter((path) => !kept.has(path)));
        }, 'details');
      },

      // Deleting frees guests' picks (on delete set null) -> the events cache too.
      deleteMenuOption: (optionId: string) => {
        const paths =
          content?.menuOptions
            .find((option) => option.id === optionId)
            ?.courses.flatMap((course) => (course.photo_path !== null ? [course.photo_path] : [])) ?? [];
        runRemote(
          async () => {
            await remoteRepository.deleteMenuOption(optionId);
            await remoteRepository.removeMenuPhotos(paths);
          },
          'details',
          [['events', user?.id ?? null]],
        );
      },

      saveMenuDeadline: (days: number) => {
        queryClient.setQueryData<DetailsContent>(detailsKey, (current) =>
          current === undefined
            ? current
            : {
                ...current,
                menu:
                  current.menu === null
                    ? { event_id: eventId, starter: '', main: '', dessert: '', choice_deadline_days: days }
                    : { ...current.menu, choice_deadline_days: days },
              },
        );
        runRemote(() => remoteRepository.saveMenuDeadline(eventId, days), 'details');
      },

      // Both of these touch event_guests.table_id (a save reassigns it, a
      // delete frees it via `on delete set null`) — that column lives in two
      // caches this hook's own 'details' key doesn't cover: the `events`
      // query's guest list (assigned-count, "X / Y seats assigned"), and the
      // `tableCompanions` RPC a guest viewer's own seating card reads (see
      // app/detalii-seating/[id].tsx) — invalidated by prefix, without the
      // trailing viewer-userId segment, since this hook (the organizer's own
      // instance) has no way to know which guest's cache entry to target.
      saveSeatingTable: (item: SeatingTableInput) => {
        runRemote(
          () => remoteRepository.saveSeatingTable(eventId, item, content?.seatingTables.length ?? 0),
          'details',
          [['events', user?.id ?? null], ['tableCompanions', eventId]],
        );
      },

      // Floor-plan drag. Patches the cache first so the table doesn't jump
      // back to its old spot while the write + refetch are in flight.
      moveSeatingTable: (tableId: string, x: number, y: number) => {
        queryClient.setQueryData<DetailsContent>(detailsKey, (current) =>
          current === undefined
            ? current
            : {
                ...current,
                seatingTables: current.seatingTables.map((table) =>
                  table.id === tableId ? { ...table, pos_x: x, pos_y: y } : table,
                ),
              },
        );
        runRemote(() => remoteRepository.moveSeatingTable(tableId, x, y), 'details');
      },

      deleteSeatingTable: (tableId: string) => {
        runRemote(
          () => remoteRepository.deleteSeatingTable(tableId),
          'details',
          [['events', user?.id ?? null], ['tableCompanions', eventId]],
        );
      },

      saveAccommodation: (item: AccommodationInput) => {
        runRemote(
          () => remoteRepository.saveAccommodation(eventId, item, content?.accommodations.length ?? 0),
          'details',
        );
      },

      deleteAccommodation: (accommodationId: string) => {
        runRemote(() => remoteRepository.deleteAccommodation(accommodationId), 'details');
      },

      saveVendor: (item: VendorInput) => {
        runRemote(
          () => remoteRepository.saveVendor(eventId, item, content?.vendors.length ?? 0),
          'details',
        );
      },

      deleteVendor: (vendorId: string) => {
        runRemote(() => remoteRepository.deleteVendor(vendorId), 'details');
      },
    }),
    [eventId, actor, hasReacted, runRemote, content, queryClient, detailsKey, user],
  );

  return { content, hasReacted, reactionCount, ...actions };
}
