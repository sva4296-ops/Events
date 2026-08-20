import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMyAgency, insertAgency, updateAgency, type AgencyInfo } from '@/data/agenciesRepository';
import { useAuth } from '@/hooks/useAuth';
import type { Agency } from '@/types/event';

interface AgencyResult {
  agency: Agency | null;
  /** Derived purely from whether a row exists for this user in `agencies` —
   * not a signup-time flag. This is the "business vs individual account"
   * check the rest of the app should read; it updates immediately (no
   * restart/re-login) after becomeAgency succeeds, via the query
   * invalidation below. */
  isAgencyOwner: boolean;
  /** False until the initial fetch completes, so callers don't flash "not an agency". */
  hydrated: boolean;
  /** Upgrades the signed-in user to a business account — app/agency-signup.tsx. */
  becomeAgency: (info: AgencyInfo) => Promise<void>;
  /** Edits the signed-in user's existing agency row — app/edit-profile.tsx's
   * business-info section. Only meaningful when isAgencyOwner is true. */
  updateAgency: (info: AgencyInfo) => Promise<void>;
}

/**
 * Plain hook, react-query backed — same shape as useEvents/useEventContent,
 * no Context/Provider.
 */
export function useAgency(): AgencyResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const queryKey = ['agency', userId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchMyAgency(userId as string),
    enabled: userId !== null,
    staleTime: 180_000,
  });

  const becomeAgencyMutation = useMutation({
    mutationFn: (info: AgencyInfo) => {
      if (userId === null) throw new Error('Not signed in.');
      return insertAgency(userId, info);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const updateAgencyMutation = useMutation({
    mutationFn: (info: AgencyInfo) => {
      if (userId === null) throw new Error('Not signed in.');
      return updateAgency(userId, info);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  return {
    agency: query.data ?? null,
    isAgencyOwner: (query.data ?? null) !== null,
    hydrated: userId === null ? true : query.isFetched,
    becomeAgency: async (info) => {
      await becomeAgencyMutation.mutateAsync(info);
    },
    updateAgency: async (info) => {
      await updateAgencyMutation.mutateAsync(info);
    },
  };
}
