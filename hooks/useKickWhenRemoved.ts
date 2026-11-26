import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState } from "react-native";

import { supabase } from "@/data/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import type { AppEvent } from "@/types/event";

type RemovalListener = (eventId: string) => void;

/** One channel per user, shared by every mounted event screen: the channel name
 * is the topic the policy checks, so it can't be made unique per mount, and
 * supabase-js hands back an already-subscribed channel for a repeated name. */
let shared: {
  userId: string;
  channel: RealtimeChannel;
  listeners: Set<RemovalListener>;
} | null = null;
/** Teardown waits a bit: moving from one event to another unmounts and mounts
 * in a row, and a channel still being removed can't be asked for again. */
let teardown: ReturnType<typeof setTimeout> | null = null;
const TEARDOWN_DELAY_MS = 5_000;

function listenForRemoval(
  userId: string,
  listener: RemovalListener,
): () => void {
  if (teardown !== null) {
    clearTimeout(teardown);
    teardown = null;
  }
  if (shared !== null && shared.userId !== userId) {
    void supabase.removeChannel(shared.channel);
    shared = null;
  }
  if (shared === null) {
    const listeners = new Set<RemovalListener>();
    const channel = supabase
      .channel(`user:${userId}`, { config: { private: true } })
      .on("broadcast", { event: "removed_from_event" }, ({ payload }) => {
        const eventId = (payload as { event_id?: string } | undefined)
          ?.event_id;
        if (typeof eventId === "string")
          listeners.forEach((notify) => notify(eventId));
      })
      .subscribe();
    shared = { userId, channel, listeners };
  }
  const current = shared;
  current.listeners.add(listener);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size > 0 || shared !== current) return;
    if (teardown !== null) clearTimeout(teardown);
    teardown = setTimeout(() => {
      teardown = null;
      if (shared === current && current.listeners.size === 0) {
        void supabase.removeChannel(current.channel);
        shared = null;
      }
    }, TEARDOWN_DELAY_MS);
  };
}

/**
 * Sends someone out of an event they were just removed from (guest or
 * co-organizer) while they had it open. RLS already blocks every read and write
 * once their event_guests row is gone; this makes the screen follow.
 *
 * Two signals refetch the events list, and the event dropping out of it is what
 * triggers the exit:
 * - A `removed_from_event` Broadcast on the user's own private topic
 *   `user:<id>`, sent by the on_event_guest_removed_notify trigger
 *   (20261112000002). Only this user receives it.
 * - Coming back to the foreground, for a removal that happened while away.
 *
 * Only fires for an event this screen has actually shown, so a deep link that
 * lands before the list has the event doesn't bounce, and never for the event's
 * own creator (deleting your event isn't being "removed").
 */
export function useKickWhenRemoved(
  event: AppEvent | undefined,
  hydrated: boolean,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const seen = useRef(false);
  const creator = useRef(false);
  const kicked = useRef(false);

  const userId = user?.id ?? null;
  const eventId = event?.id ?? null;

  useEffect(() => {
    if (userId === null || eventId === null) return;
    return listenForRemoval(userId, (removedEventId) => {
      if (removedEventId === eventId)
        void queryClient.invalidateQueries({ queryKey: ["events"] });
    });
  }, [userId, eventId, queryClient]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active")
        void queryClient.invalidateQueries({ queryKey: ["events"] });
    });
    return () => subscription.remove();
  }, [queryClient]);

  useEffect(() => {
    if (!hydrated) return;
    if (event !== undefined) {
      seen.current = true;
      creator.current = userId !== null && event.owner_id === userId;
      return;
    }
    if (!seen.current || creator.current || kicked.current) return;
    kicked.current = true;
    // Pops back to Home, or replaces with it when Home isn't in the stack.
    router.dismissTo("/");
    Alert.alert(t("guestRemoved.title"), t("guestRemoved.body"));
  }, [event, hydrated, userId, t]);
}
