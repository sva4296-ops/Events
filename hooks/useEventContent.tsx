import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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

interface StoreValue {
  byEvent: Record<string, EventContent>;
  ensure: (eventId: string) => void;
  update: (eventId: string, updater: (content: EventContent) => EventContent) => void;
  mode: 'supabase' | 'local';
}

const StoreContext = createContext<StoreValue | null>(null);

/**
 * Content lives at the app root, not inside the tabs, so owner screens outside
 * the tab navigator (edit event, schedule, venue, fund, post a moment) mutate the
 * same content state.
 */
export function EventContentProvider({ children }: { children: ReactNode }) {
  const { user, mode } = useAuth();
  const [byEvent, setByEvent] = useState<Record<string, EventContent>>({});
  const requested = useRef(new Set<string>());

  // Drop cached content when the session changes so nothing leaks between accounts.
  // Consumers re-request on their next render because their effect watches `content`.
  const userId = user?.id;
  const lastUserId = useRef<string | undefined>(userId);

  useEffect(() => {
    if (lastUserId.current === userId) return;
    lastUserId.current = userId;
    requested.current.clear();
    setByEvent({});
  }, [userId]);

  const ensure = useCallback(
    (eventId: string) => {
      if (requested.current.has(eventId)) return;
      requested.current.add(eventId);

      const loader = mode === 'supabase' ? remoteRepository.load : localRepository.load;
      void loader(eventId)
        .then((loaded) => {
          setByEvent((current) => ({ ...current, [eventId]: loaded }));
        })
        .catch((error: unknown) => {
          requested.current.delete(eventId);
          reportSupabaseError(error);
        });
    },
    [mode],
  );

  const update = useCallback(
    (eventId: string, updater: (content: EventContent) => EventContent) => {
      setByEvent((current) => {
        const existing = current[eventId];
        if (existing === undefined) return current;
        return { ...current, [eventId]: updater(existing) };
      });
    },
    [],
  );

  const value = useMemo<StoreValue>(
    () => ({ byEvent, ensure, update, mode }),
    [byEvent, ensure, update, mode],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useEventContent(eventId: string) {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error('useEventContent must be used inside <EventContentProvider>');
  }

  const { user } = useAuth();
  const { byEvent, ensure, update, mode } = store;
  const content = byEvent[eventId] ?? null;

  const actor: Actor = useMemo(
    () => ({ id: user?.id ?? 'anonymous', label: user?.email ?? 'Tu' }),
    [user],
  );

  // Depends on `content` so it re-requests after the cache is dropped on a session
  // change; `ensure` de-dupes, so this settles after one load.
  useEffect(() => {
    if (eventId.length > 0 && content === null) ensure(eventId);
  }, [eventId, ensure, content]);

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

  /** Re-reads this event's content from Supabase and replaces the cached copy — the
   * source of truth after any remote write, since remote writes aren't optimistic. */
  const refreshContent = useCallback(async () => {
    const fresh = await remoteRepository.load(eventId);
    update(eventId, () => fresh);
  }, [eventId, update]);

  const runRemote = useCallback(
    (mutate: () => Promise<void>) => {
      void mutate()
        .then(refreshContent)
        .catch((error: unknown) => reportSupabaseError(error));
    },
    [refreshContent],
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

        update(eventId, (current) => {
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

        update(eventId, (current) => ({
          ...current,
          messages: [...current.messages, localRepository.sendMessage(eventId, trimmed, actor)],
        }));
      },

      addPhoto: (url: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.addPhoto(eventId, url, actor));
          return;
        }

        update(eventId, (current) => ({
          ...current,
          photos: [localRepository.addPhoto(eventId, url, actor), ...current.photos],
        }));
      },

      /** Local-only: nothing writes contributions client-side even against Supabase —
       * the schema has no insert policy on purpose, contributions land via a Stripe
       * webhook using the service role. Unused today since checkout is a stub. */
      contribute: (amount: number) =>
        update(eventId, (current) =>
          current.fund === null
            ? current
            : {
                ...current,
                fund: { ...current.fund, current_amount: current.fund.current_amount + amount },
              },
        ),

      /** Optimistic prepend in local mode; a refetch in Supabase mode. */
      addMoment: (title: string, photoUrl: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.createMoment(eventId, title, photoUrl, actor));
          return;
        }

        update(eventId, (current) => ({
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

        update(eventId, (current) => ({
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

        update(eventId, (current) => ({ ...current, fund: null, contributions: [] }));
      },

      saveScheduleItem: (item: ScheduleItemInput) => {
        if (mode === 'supabase') {
          runRemote(() =>
            remoteRepository.saveScheduleItem(eventId, item, content?.schedule.length ?? 0),
          );
          return;
        }

        update(eventId, (current) => {
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

        update(eventId, (current) => ({
          ...current,
          schedule: current.schedule.filter((item) => item.id !== itemId),
        }));
      },

      deleteMoment: (momentId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deleteMoment(momentId));
          return;
        }

        update(eventId, (current) => ({
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

        update(eventId, (current) => ({
          ...current,
          messages: current.messages.filter((message) => message.id !== messageId),
        }));
      },

      deletePhoto: (photoId: string) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.deletePhoto(photoId));
          return;
        }

        update(eventId, (current) => ({
          ...current,
          photos: current.photos.filter((photo) => photo.id !== photoId),
        }));
      },

      updateVenue: (venue: Venue) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.updateVenue(venue));
          return;
        }

        update(eventId, (current) => ({ ...current, venue }));
      },

      saveMenu: (input: MenuInput) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.saveMenu(eventId, input));
          return;
        }

        update(eventId, (current) => ({ ...current, menu: { event_id: eventId, ...input } }));
      },

      saveSeatingTable: (item: SeatingTableInput) => {
        if (mode === 'supabase') {
          runRemote(() =>
            remoteRepository.saveSeatingTable(eventId, item, content?.seatingTables.length ?? 0),
          );
          return;
        }

        update(eventId, (current) => {
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

        update(eventId, (current) => ({
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

        update(eventId, (current) => {
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

        update(eventId, (current) => ({
          ...current,
          accommodations: current.accommodations.filter((entry) => entry.id !== accommodationId),
        }));
      },

      saveVendor: (item: VendorInput) => {
        if (mode === 'supabase') {
          runRemote(() => remoteRepository.saveVendor(eventId, item, content?.vendors.length ?? 0));
          return;
        }

        update(eventId, (current) => {
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

        update(eventId, (current) => ({
          ...current,
          vendors: current.vendors.filter((vendor) => vendor.id !== vendorId),
        }));
      },
    }),
    [eventId, update, actor, mode, hasReacted, runRemote, content],
  );

  return { content, hasReacted, reactionCount, ...actions };
}
