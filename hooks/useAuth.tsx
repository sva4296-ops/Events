import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { supabase } from '@/data/supabaseClient';
import { getOnboardingCache, setOnboardingCache } from '@/utils/onboarding';

export interface AppUser {
  id: string;
  email: string | null;
  phone: string | null;
  label: string;
}

/** Supabase's OTP delivery channel — SMS today; the parameter exists from the
 * start (rather than being hardcoded) so a WhatsApp toggle later is a UI
 * addition, not a refactor. Whichever channel sends it, Supabase's verify
 * step always uses type: 'sms' — unverified from this environment. */
export type PhoneOtpChannel = 'sms' | 'whatsapp';

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Sends (or resends) an OTP to `phone` — the only auth method. Same call
   * for a brand-new or returning phone number — Supabase creates the user on
   * first use, so there's no separate "sign up," and no email path at all
   * anymore: email is a plain, optional profile field now (see
   * hooks/useUserProfile.tsx), never an identifier this layer touches. */
  signInWithPhoneOtp: (phone: string, channel?: PhoneOtpChannel) => Promise<string | null>;
  /** Verifies the code and establishes a normal session — onAuthStateChange
   * picks it up exactly like any other sign-in, no separate handling needed. */
  verifyPhoneOtp: (phone: string, token: string) => Promise<string | null>;
  /** Requests a phone number change — Supabase sends an OTP to the new
   * number; auth.users.phone doesn't change until verifyPhoneChange confirms
   * it, a "request, then verify" shape. This is the only contact-method
   * change left in this file — there's no updateEmail, since email is no
   * longer part of auth.users at all as far as this app is concerned. */
  updatePhone: (phone: string) => Promise<string | null>;
  /** Confirms a updatePhone() request with the code Supabase sent to the new
   * number — verify type is 'phone_change', not 'sms' (that's only for
   * signInWithPhoneOtp/verifyPhoneOtp's initial-sign-in challenge). */
  verifyPhoneChange: (phone: string, token: string) => Promise<string | null>;
  /** Local cache first, public.users.has_completed_onboarding as source of truth. */
  hasCompletedOnboarding: () => Promise<boolean>;
  markOnboardingComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const session = data.session;
      setUser(
        session === null
          ? null
          : {
              id: session.user.id,
              email: session.user.email ?? null,
              phone: session.user.phone ?? null,
              label: session.user.email ?? session.user.phone ?? 'Tu',
            },
      );
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(
        session === null
          ? null
          : {
              id: session.user.id,
              email: session.user.email ?? null,
              phone: session.user.phone ?? null,
              label: session.user.email ?? session.user.phone ?? 'Tu',
            },
      );
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const signInWithPhoneOtp = useCallback(async (phone: string, channel: PhoneOtpChannel = 'sms') => {
    const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel } });
    return error?.message ?? null;
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    return error?.message ?? null;
  }, []);

  const updatePhone = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.updateUser({ phone });
    return error?.message ?? null;
  }, []);

  const verifyPhoneChange = useCallback(async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'phone_change' });
    return error?.message ?? null;
  }, []);

  const hasCompletedOnboarding = useCallback(async (): Promise<boolean> => {
    if (user === null) return false;

    const cached = await getOnboardingCache(user.id);
    if (cached) return true;

    const { data, error } = await supabase
      .from('users')
      .select('has_completed_onboarding')
      .eq('id', user.id)
      .maybeSingle();

    if (error || data === null || data.has_completed_onboarding !== true) return false;

    await setOnboardingCache(user.id);
    return true;
  }, [user]);

  /** Best-effort — a failed background sync here just means the tutorial shows
   * again on another device, not data loss. */
  const markOnboardingComplete = useCallback(async (): Promise<void> => {
    if (user === null) return;
    await setOnboardingCache(user.id);
    await supabase.from('users').update({ has_completed_onboarding: true }).eq('id', user.id);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signOut,
      signInWithPhoneOtp,
      verifyPhoneOtp,
      updatePhone,
      verifyPhoneChange,
      hasCompletedOnboarding,
      markOnboardingComplete,
    }),
    [
      user,
      loading,
      signOut,
      signInWithPhoneOtp,
      verifyPhoneOtp,
      updatePhone,
      verifyPhoneChange,
      hasCompletedOnboarding,
      markOnboardingComplete,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
