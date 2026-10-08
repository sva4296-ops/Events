import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/data/supabaseClient';
import { saveUserLocale } from '@/data/usersRepository';
import i18n from '@/utils/i18n';
import { generateId } from '@/utils/uuid';

/**
 * Push notifications via Expo Push (FCM on Android). Tokens live in
 * public.push_tokens, written only through the register/unregister RPCs;
 * the sending happens server-side (see
 * supabase/migrations/20261001000002_push_notifications.sql).
 *
 * iOS needs an Apple Developer account for APNs; until then getting a token
 * there fails and is ignored, the same as on an emulator without Play services.
 */

/** Event whose chat is on screen right now (set by the Chat tab). */
let activeChatEventId: string | null = null;

export function setActiveChat(eventId: string | null): void {
  activeChatEventId = eventId;
}

// Shown as a banner while the app is open, too, except a chat push for the
// chat you're already reading.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as { type?: unknown; event_id?: unknown } | undefined;
    const inThatChat =
      data?.type === 'chat_message' && activeChatEventId !== null && data.event_id === activeChatEventId;
    return {
      shouldShowBanner: !inThatChat,
      shouldShowList: !inThatChat,
      shouldPlaySound: !inThatChat,
      shouldSetBadge: false,
    };
  },
});

/** Last token registered on this device, so sign-out can remove it. */
let currentToken: string | null = null;

/** Stable per install, so a new token replaces this install's old one server-side. */
const DEVICE_ID_KEY = 'povesteanoastra:device-id:v1';

async function getDeviceId(): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (stored !== null) return stored;
    const created = generateId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return null;
  }
}

/** Device-wide on/off from Profile. Absent = on (the default). */
const PREFERENCE_KEY = 'povesteanoastra:push-enabled:v1';

export async function isPushPreferenceEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREFERENCE_KEY)) !== 'off';
  } catch {
    return true;
  }
}

/** What Profile's switch shows: the user's choice AND the OS permission. */
export async function isPushActive(): Promise<boolean> {
  if (!(await isPushPreferenceEnabled())) return false;
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export type EnablePushResult = 'enabled' | 'blocked' | 'failed';

/** Profile switch on. 'blocked' = the OS won't ask again; send the user to Settings. */
export async function enablePushNotifications(): Promise<EnablePushResult> {
  await AsyncStorage.setItem(PREFERENCE_KEY, 'on').catch(() => undefined);
  const existing = await Notifications.getPermissionsAsync().catch(() => null);
  if (existing !== null && !existing.granted && !existing.canAskAgain) return 'blocked';
  return (await registerForPushNotifications()) ? 'enabled' : 'failed';
}

/** Profile switch off: stop pushes to this device for any account signed in here. */
export async function disablePushNotifications(): Promise<void> {
  await AsyncStorage.setItem(PREFERENCE_KEY, 'off').catch(() => undefined);
  await unregisterPushToken().catch(() => undefined);
}

/** True once this device's token is saved for the signed-in user. */
export async function registerForPushNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      // Must exist before the permission prompt on Android 13+. Matches the
      // channelId the server sends.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificări',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    const granted = existing.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;

    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
      p_device_id: await getDeviceId(),
    });
    if (error) throw error;
    currentToken = token;
    return true;
  } catch (err) {
    // No Sentry in this codebase; never block the app on push setup.
    console.warn('[push] registration failed', err);
    return false;
  }
}

/**
 * Pushes are written server-side in the user's language (users.locale).
 * Best-effort: on failure they keep getting the previous language.
 */
export async function syncPushLocale(userId: string): Promise<void> {
  const language = i18n.language;
  if (language !== 'en' && language !== 'ro') return;
  try {
    await saveUserLocale(userId, language);
  } catch (err) {
    console.warn('[push] locale sync failed', err);
  }
}

/** Best-effort: a failure just means the old account may still get a push. */
export async function unregisterPushToken(): Promise<void> {
  // Registration may have failed this launch while an older row still exists.
  const token = currentToken ?? (await currentDeviceToken());
  currentToken = null;
  if (token === null) return;
  await supabase.rpc('unregister_push_token', { p_token: token });
}

async function currentDeviceToken(): Promise<string | null> {
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return null;
    const projectId = (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

/** Event id out of a notification route: `/event/<id>` or `/guest/<id>[/tab]`. */
export function eventIdFromRoute(route: string | null): string | null {
  const match = route?.match(/^\/(?:event|guest|detalii-menu|story)\/([^/?#]+)/);
  return match?.[1] ?? null;
}

/** In-app route carried in a notification's data (`{ url: '/event/<id>' }`). */
export function routeFromNotification(response: Notifications.NotificationResponse | null): string | null {
  const url: unknown = response?.notification.request.content.data?.url;
  return typeof url === 'string' && url.startsWith('/') ? url : null;
}
