import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyProfile, saveUserName } from '@/data/usersRepository';
import { useAuth } from '@/hooks/useAuth';

interface UserProfileResult {
  firstName: string | null;
  lastName: string | null;
  /** Prefer this over user.email/user.phone anywhere the UI shows "who is
   * this" — falls back to null (never to email/phone itself; callers already
   * have those on useAuth().user for their own last-resort fallback). */
  displayName: string | null;
  /** False until the initial fetch completes — AuthGate's name-step redirect
   * waits on this so it doesn't fire on stale/absent data. */
  hydrated: boolean;
  saveName: (firstName: string, lastName: string) => Promise<void>;
}

/**
 * Plain hook, react-query backed — same shape as useAgency, no
 * Context/Provider. Read by AuthGate (gates the one-time name step),
 * app/name.tsx (writes it), app/profile.tsx, and the guest/organizer
 * identity fallbacks in useEvents/useEventContent.
 */
export function useUserProfile(): UserProfileResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = ['userProfile', userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchMyProfile(userId as string),
    enabled: userId !== null,
    staleTime: 180_000,
  });

  const saveNameMutation = useMutation({
    mutationFn: (vars: { firstName: string; lastName: string }) => {
      if (userId === null) throw new Error('Not signed in.');
      return saveUserName(userId, vars.firstName, vars.lastName);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return {
    firstName: query.data?.firstName ?? null,
    lastName: query.data?.lastName ?? null,
    displayName: query.data?.displayName ?? null,
    hydrated: userId === null ? true : query.isFetched,
    saveName: async (firstName, lastName) => {
      await saveNameMutation.mutateAsync({ firstName, lastName });
    },
  };
}
