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
  label: string;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
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
              label: session.user.email ?? 'Tu',
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
              label: session.user.email ?? 'Tu',
            },
      );
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  /** Returns an error message, or null on success. */
  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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
      signUp,
      signIn,
      signOut,
      hasCompletedOnboarding,
      markOnboardingComplete,
    }),
    [user, loading, signUp, signIn, signOut, hasCompletedOnboarding, markOnboardingComplete],
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
