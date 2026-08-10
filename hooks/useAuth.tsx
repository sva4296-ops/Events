import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { isSupabaseConfigured, supabase } from '@/data/supabaseClient';
import { createId } from '@/utils/id';
import { getOnboardingCache, setOnboardingCache } from '@/utils/onboarding';

const LOCAL_USER_KEY = 'povesteanoastra:local-user:v1';

export interface AppUser {
  id: string;
  email: string | null;
  label: string;
}

interface AuthContextValue {
  user: AppUser | null;
  /** 'supabase' once credentials exist; 'local' is the offline fallback identity. */
  mode: 'supabase' | 'local';
  loading: boolean;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Local cache first, public.users.has_completed_onboarding as source of truth. */
  hasCompletedOnboarding: () => Promise<boolean>;
  markOnboardingComplete: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Stable per-device id so ownership checks survive restarts without a backend. */
async function loadLocalUser(): Promise<AppUser> {
  try {
    const stored = await AsyncStorage.getItem(LOCAL_USER_KEY);
    if (stored !== null) return JSON.parse(stored) as AppUser;
  } catch {
    // fall through and mint a new one
  }

  const user: AppUser = { id: `local-${createId()}`, email: null, label: 'Tu' };
  try {
    await AsyncStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  } catch {
    // Non-persistent identity is still usable for this session.
  }
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mode = isSupabaseConfigured ? 'supabase' : 'local';

  useEffect(() => {
    let active = true;

    if (supabase === null) {
      void loadLocalUser().then((local) => {
        if (!active) return;
        setUser(local);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }

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
    if (supabase === null) return 'Supabase is not configured on this build.';
    const { error } = await supabase.auth.signUp({ email, password });
    return error?.message ?? null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (supabase === null) return 'Supabase is not configured on this build.';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase === null) return;
    await supabase.auth.signOut();
  }, []);

  const hasCompletedOnboarding = useCallback(async (): Promise<boolean> => {
    if (user === null) return false;

    const cached = await getOnboardingCache(user.id);
    if (cached) return true;

    // Local mode has no public.users row to check against — the cache above is
    // the only source of truth there.
    if (supabase === null) return false;

    const { data, error } = await supabase
      .from('users')
      .select('has_completed_onboarding')
      .eq('id', user.id)
      .maybeSingle();

    if (error || data === null || data.has_completed_onboarding !== true) return false;

    await setOnboardingCache(user.id);
    return true;
  }, [user]);

  /** Best-effort like utils/storage.ts's saveEvents — a failed background sync
   * here just means the tutorial shows again on another device, not data loss. */
  const markOnboardingComplete = useCallback(async (): Promise<void> => {
    if (user === null) return;
    await setOnboardingCache(user.id);
    if (supabase === null) return;
    await supabase.from('users').update({ has_completed_onboarding: true }).eq('id', user.id);
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      mode,
      loading,
      signUp,
      signIn,
      signOut,
      hasCompletedOnboarding,
      markOnboardingComplete,
    }),
    [user, mode, loading, signUp, signIn, signOut, hasCompletedOnboarding, markOnboardingComplete],
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
