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
  /** Signed URL into the private `avatars` bucket, re-derived on every
   * fetch (see fetchAvatarUrl) — null if the user has never uploaded one.
   * Not a stored column; the object path is fully derivable from the
   * user's own id, same "no new column" convention as event photo paths. */
  avatarUrl: string | null;
}

const AVATAR_BUCKET = 'avatars';
/** Regenerated on every fetchMyProfile (staleTime 180s for this query — see
 * useUserProfile.tsx), so this only needs to outlive a few renders, not be
 * long-lived — same reasoning as event photos' own signed-URL TTL. */
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
async function fetchAvatarUrl(userId: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(avatarStoragePath(userId), AVATAR_SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export async function fetchMyProfile(userId: string): Promise<UserProfile | null> {
  const [{ data, error }, avatarUrl] = await Promise.all([
    supabase
      .from('users')
      .select('first_name, last_name, display_name, email')
      .eq('id', userId)
      .maybeSingle(),
    fetchAvatarUrl(userId),
  ]);
  if (error) throw error;
  return data === null ? null : { ...mapUserProfileRow(data as UserProfileRow), avatarUrl };
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

/**
 * app/edit-profile.tsx's email field — a plain column write, no Supabase Auth
 * involved and no re-verification, unlike updatePhone/verifyPhoneChange in
 * hooks/useAuth.tsx. `email` is `null` to clear the field back to blank.
 */
export async function saveContactEmail(userId: string, email: string | null): Promise<void> {
  const { error } = await supabase.from('users').update({ email }).eq('id', userId);
  if (error) throw error;
}
