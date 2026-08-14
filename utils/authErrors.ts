import i18n from '@/utils/i18n';

export interface AuthFieldErrors {
  email?: string;
  password?: string;
}

/**
 * Maps Supabase's error strings onto the field they belong under. Shared by
 * app/auth/index.tsx (individual sign-in/sign-up) and
 * app/auth/agency-signup.tsx — both call supabase.auth.signUp/signInWithPassword
 * and need the same classification, so this lives here rather than being
 * duplicated per screen. Module-scope, not a component, so this uses the
 * i18next singleton's `t` directly — same reasoning as utils/format.ts's
 * formatEventDate.
 */
export function mapAuthError(message: string): AuthFieldErrors {
  const text = message.toLowerCase();

  if (text.includes('already registered') || text.includes('already been registered')) {
    return { email: i18n.t('auth.errors.alreadyRegistered') };
  }
  if (text.includes('invalid login credentials')) {
    return { password: i18n.t('auth.errors.invalidCredentials') };
  }
  if (text.includes('email not confirmed')) {
    return { email: i18n.t('auth.errors.emailNotConfirmed') };
  }
  // Below this point the message is whatever Supabase returned, in whichever
  // language it returned it in — there's no translation table for arbitrary
  // server error text, so it passes through as-is.
  if (text.includes('password')) {
    return { password: message };
  }
  if (text.includes('email')) {
    return { email: message };
  }
  return { password: message };
}
