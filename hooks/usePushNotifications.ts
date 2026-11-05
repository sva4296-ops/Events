import * as Notifications from 'expo-notifications';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { whenAppReady } from '@/utils/appReady';
import {
  eventIdFromRoute,
  isPushPreferenceEnabled,
  registerForPushNotifications,
  routeFromNotification,
  syncPushLocale,
} from '@/utils/pushNotifications';

/**
 * Mounted on Home (always under the stack once signed in, past AuthGate's
 * name/onboarding steps): registers this device's push token once per
 * signed-in account (unless switched off in Profile), and opens the route a tapped notification points to,
 * both while running and when the tap cold-started the app.
 */
const PROMPT_DELAY_MS = 1200;

// Module-level, not a ref: Home can remount (e.g. on back from the screen the
// notification opened), and a fresh ref would treat the same tap as new.
const handledResponses = new Set<string>();

/**
 * A push means that event just changed server-side (new RSVP, new date or
 * venue, new moment...). Refetch its cached data instead of waiting out
 * staleTime (3 min for details), so the screen it opens isn't stale.
 */
function refreshEventData(queryClient: QueryClient, route: string | null): void {
  const eventId = eventIdFromRoute(route);
  // '/' = an event was deleted (on_event_delete_notify): only Home's list changes.
  if (eventId === null && route !== '/') return;
  void queryClient.invalidateQueries({ queryKey: ['events'] });
  void queryClient.invalidateQueries({ queryKey: ['unreadChats'] });
  if (eventId === null) return;
  void queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] === 'eventContent' && query.queryKey[2] === eventId,
  });
}

export function usePushNotifications(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const registeredFor = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const userId = user?.id ?? null;

  // Server-side push copy follows the app language (also re-synced on change in Profile).
  useEffect(() => {
    if (userId !== null) void syncPushLocale(userId);
  }, [userId]);

  useEffect(() => {
    if (user === null || registeredFor.current === user.id) return;
    const userId = user.id;
    // Not over the splash: wait until it has faded out, then give Home a
    // moment on screen before the system permission prompt can appear.
    // Respects the Profile switch: turned off on this device = no prompt, no token.
    let cancelled = false;
    void whenAppReady()
      .then(() => new Promise((resolve) => setTimeout(resolve, PROMPT_DELAY_MS)))
      .then(() => (cancelled ? false : isPushPreferenceEnabled()))
      .then((enabled) => {
        // Marked only here, so a re-run during the wait (e.g. a session
        // refresh recreating `user`) cancels this one and the next takes over.
        if (!enabled || cancelled || registeredFor.current === userId) return;
        registeredFor.current = userId;
        return registerForPushNotifications();
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Covers both the cold-start tap and taps while the app is running.
  useEffect(() => {
    if (lastResponse === null || lastResponse === undefined) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponses.has(id)) return;
    handledResponses.add(id);
    // Consume it, so the hook stops returning this tap once we've navigated.
    Notifications.clearLastNotificationResponse();
    const route = routeFromNotification(lastResponse);
    refreshEventData(queryClient, route);
    if (route !== null) router.push(route as never);
  }, [lastResponse, queryClient]);

  // Arriving while the app is open (no tap): refresh too, so whatever screen
  // is showing that event updates on its own.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const url: unknown = notification.request.content.data?.url;
      refreshEventData(queryClient, typeof url === 'string' ? url : null);
    });
    return () => subscription.remove();
  }, [queryClient]);
}
