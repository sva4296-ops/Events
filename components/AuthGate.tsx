import { router, useSegments } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';

/** Route groups reachable without a session. Everything else requires one. */
const PUBLIC_SEGMENTS = new Set(['auth', 'onboarding', 'invite']);

/**
 * Redirects to the auth screen whenever a protected route is rendered without a
 * session — including mid-session expiry, since it re-runs on every auth change.
 * Also owns two post-auth decisions, in order: the one-time name step (any
 * account with no first_name yet, old or new, email or phone), then the
 * onboarding tutorial. Splash always reveals into Home/whatever route is
 * current; this is what actually decides "Auth" vs "Name" vs "Onboarding" vs
 * "let it through." The auth flow itself never collects a name (it's just
 * identifier + code, see app/auth/index.tsx), so this is the only place a
 * name gets requested.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, hasCompletedOnboarding } = useAuth();
  const { firstName, hydrated: profileHydrated } = useUserProfile();
  const segments = useSegments();
  // Tracks which signed-in user id has already had its onboarding status
  // checked this session, so the async check doesn't re-run on every
  // navigation — only once per user going from null to non-null. The name
  // check has no equivalent ref: it re-evaluates every run (same as the
  // no-session -> /auth redirect below) so it naturally stops redirecting
  // the moment firstName flips from null to set, with no separate signal
  // needed to know the step just finished.
  const onboardingChecked = useRef<string | null>(null);

  useEffect(() => {
    if (loading) return;

    const first = segments[0];
    const isPublic = first !== undefined && PUBLIC_SEGMENTS.has(first);

    if (user === null) {
      onboardingChecked.current = null;
      if (!isPublic) {
        router.replace('/auth');
      }
      return;
    }

    if (!profileHydrated) return;

    if (firstName === null) {
      router.replace('/auth/complete-profile');
      return;
    }

    if (onboardingChecked.current === user.id) return;
    onboardingChecked.current = user.id;

    void hasCompletedOnboarding().then((completed) => {
      if (!completed) router.replace('/onboarding');
    });
  }, [user, loading, segments, hasCompletedOnboarding, profileHydrated, firstName]);

  return <>{children}</>;
}
