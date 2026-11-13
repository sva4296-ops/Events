import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/data/supabaseClient';
import type { UserProfileRow } from '@/types/supabase';

/**
 * Supabase-backed public.users profile fields. hooks/useUserProfile.tsx is
 * the only caller. RLS limits this to the caller's own row (id = auth.uid()),
 * same as every other public.users read in this app.
 */

export interface UserProfile {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  /** A plain profile field now — never used for login, signup, or account
   * verification. auth.users.email is basically always null since phone is
   * the only auth method; this is a separate, freely-editable column the
   * user can fill in or leave blank. */
  email: string | null;
}

/**
 * The signed URL changes on every fetch; `cacheKey` is what keeps the image on
 * disk across restarts. It holds the day, so another device's new photo shows up
 * by tomorrow, and a local version, so this device's own upload shows right away.
 */
export interface UserAvatar {
  url: string;
  cacheKey: string;
}

const AVATAR_BUCKET = 'avatars';
/** Must outlive the avatar query's staleTime (useUserProfile.tsx). */
const AVATAR_SIGNED_URL_TTL_SECONDS = 60 * 60;

function avatarStoragePath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

function mapUserProfileRow(row: UserProfileRow): Omit<UserProfile, 'avatarUrl'> {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    email: row.email,
  };
}

/** Null (not thrown) when the user has no avatar yet — createSignedUrl
 * errors for a path that doesn't exist, and "no avatar" is an expected,
 * common state, not a failure. */
export async function fetchMyAvatar(userId: string): Promise<UserAvatar | null> {
  const [{ data, error }, version] = await Promise.all([
    supabase.storage.from(AVATAR_BUCKET).createSignedUrl(avatarStoragePath(userId), AVATAR_SIGNED_URL_TTL_SECONDS),
    AsyncStorage.getItem(avatarVersionKey(userId)),
  ]);
  if (error) return null;
  const day = new Date().toISOString().slice(0, 10);
  return { url: data.signedUrl, cacheKey: `avatar-${userId}-${day}-${version ?? '0'}` };
}

function avatarVersionKey(userId: string): string {
  return `povesteanoastra:avatar-version:${userId}`;
}

/** Called after an upload, so the next fetch doesn't reuse the old image from disk. */
export async function bumpAvatarVersion(userId: string): Promise<void> {
  await AsyncStorage.setItem(avatarVersionKey(userId), String(Date.now()));
}

export async function fetchMyProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('first_name, last_name, display_name, email')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data === null ? null : mapUserProfileRow(data as UserProfileRow);
}

/** userId -> signed URL for those who have an avatar and whose avatar the caller may
 * see; everyone else is simply missing, and gets initials. */
export async function fetchAvatarUrls(userIds: string[], ttlSeconds: number): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(userIds.map(avatarStoragePath), ttlSeconds);
  if (error) throw error;
  const urls: Record<string, string> = {};
  (data ?? []).forEach((entry, index) => {
    const userId = userIds[index];
    if (userId !== undefined && entry.signedUrl) urls[userId] = entry.signedUrl;
  });
  return urls;
}

/**
 * Overwrites the user's one avatar object (`upsert: true` — same path every
 * time, so a re-upload just replaces it in place, no old-file cleanup step
 * needed). `localUri` is already resized/compressed by
 * utils/imageProcessing.ts's processAvatarPhoto before this is called.
 */
export async function uploadUserAvatar(userId: string, localUri: string): Promise<void> {
  const buffer = await fetch(localUri).then((res) => res.arrayBuffer());
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(avatarStoragePath(userId), buffer, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
}

/**
 * The one-time name step's write — sets first_name/last_name and derives
 * display_name from them, so every existing display_name consumer (message
 * sender_label, photo/moment attribution, the guest-name auto-link backfill
 * in 20260820000001_user_names.sql) picks up the real name for free.
 */
export async function saveUserName(userId: string, firstName: string, lastName: string): Promise<void> {
  const displayName = `${firstName} ${lastName}`.trim();
  const { error } = await supabase
    .from('users')
    .update({ first_name: firstName, last_name: lastName, display_name: displayName })
    .eq('id', userId);
  if (error) throw error;
}

/** Language for server-sent push copy; see utils/pushNotifications.ts's syncPushLocale. */
export async function saveUserLocale(userId: string, locale: 'en' | 'ro'): Promise<void> {
  const { error } = await supabase.from('users').update({ locale }).eq('id', userId);
  if (error) throw error;
}

/**
 * app/edit-profile.tsx's email field — a plain column write, no Supabase Auth
 * involved and no re-verification, unlike updatePhone/verifyPhoneChange in
 * hooks/useAuth.tsx. `email` is `null` to clear the field back to blank.
 */
export async function saveContactEmail(userId: string, email: string | null): Promise<void> {
  const { error } = await supabase.from('users').update({ email }).eq('id', userId);
  if (error) throw error;
}
