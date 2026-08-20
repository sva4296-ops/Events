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

function mapUserProfileRow(row: UserProfileRow): UserProfile {
  return {
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    email: row.email,
  };
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
