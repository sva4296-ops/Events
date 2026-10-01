import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { whenAppReady } from '@/utils/appReady';
import {
  isPushPreferenceEnabled,
  registerForPushNotifications,
  routeFromNotification,
} from '@/utils/pushNotifications';

/**
 * Mounted on Home (always under the stack once signed in, past AuthGate's
 * name/onboarding steps): registers this device's push token once per
 * signed-in account (unless switched off in Profile), and opens the route a tapped notification points to,
 * both while running and when the tap cold-started the app.
 */
const PROMPT_DELAY_MS = 1200;

export function usePushNotifications(): void {
  const { user } = useAuth();
  const registeredFor = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledResponse = useRef<string | null>(null);

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
    if (handledResponse.current === id) return;
    handledResponse.current = id;
    const route = routeFromNotification(lastResponse);
    if (route !== null) router.push(route as never);
  }, [lastResponse]);
}
