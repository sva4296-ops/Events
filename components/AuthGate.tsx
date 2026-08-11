import { router, useSegments } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';

import { useAuth } from '@/hooks/useAuth';

/** Route groups reachable without a session. Everything else requires one. */
const PUBLIC_SEGMENTS = new Set(['auth', 'onboarding', 'invite']);

/**
 * Redirects to the auth screen whenever a protected route is rendered without a
 * session — including mid-session expiry, since it re-runs on every auth change.
 * Also owns the post-auth onboarding decision: once per session, checks whether
 * this account has completed onboarding and routes to it if not. Splash always
 * reveals into Home/whatever route is current; this is what actually decides
 * "Auth" vs "Onboarding" vs "let it through."
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, hasCompletedOnboarding } = useAuth();
  const segments = useSegments();
  // Tracks which signed-in user id has already had its onboarding status
  // checked this session, so the async check doesn't re-run on every
  // navigation — only once per user going from null to non-null.
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

    if (onboardingChecked.current === user.id) return;
    onboardingChecked.current = user.id;

    void hasCompletedOnboarding().then((completed) => {
      if (!completed) router.replace('/onboarding');
    });
  }, [user, loading, segments, hasCompletedOnboarding]);

  return <>{children}</>;
}
