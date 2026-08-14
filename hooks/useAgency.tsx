import { useQuery } from '@tanstack/react-query';

import { fetchMyAgency } from '@/data/agenciesRepository';
import { useAuth } from '@/hooks/useAuth';
import type { Agency } from '@/types/event';

interface AgencyResult {
  agency: Agency | null;
  isAgencyOwner: boolean;
  /** False until the initial fetch completes, so callers don't flash "not an agency". */
  hydrated: boolean;
}

/**
 * Plain hook, react-query backed — same shape as useEvents/useEventContent,
 * no Context/Provider. "Rarely changes once created" (no agency-edit screen
 * exists this pass), so this gets details-category staleTime rather than the
 * 30s list treatment.
 */
export function useAgency(): AgencyResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ['agency', userId] as const,
    queryFn: () => fetchMyAgency(userId as string),
    enabled: userId !== null,
    staleTime: 180_000,
  });

  return {
    agency: query.data ?? null,
    isAgencyOwner: (query.data ?? null) !== null,
    hydrated: userId === null ? true : query.isFetched,
  };
}
