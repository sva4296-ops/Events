import { useQuery } from '@tanstack/react-query';

import { fetchPlanFeatures } from '@/data/planFeaturesRepository';
import type { PlanFeature } from '@/types/pricing';

/**
 * Plain hook, react-query backed — same shape as useAgency/useUserProfile,
 * no Context/Provider. No `enabled` gate on a signed-in user: plan_features
 * is publicly readable (see the migration's RLS policy), so this can run
 * for a signed-out viewer too, unlike useAgency/useUserProfile.
 */
export function usePlanFeatures(): {
  plans: PlanFeature[];
  /** False until the initial fetch completes, so callers don't flash an empty list. */
  hydrated: boolean;
} {
  const query = useQuery({
    queryKey: ['planFeatures'],
    queryFn: fetchPlanFeatures,
    // Config data, edited from the Supabase dashboard, not by any app
    // action — same "rarely changes" reasoning as useAgency's 180s, held a
    // bit longer since nothing in this app ever invalidates this key.
    staleTime: 300_000,
  });

  return {
    plans: query.data ?? [],
    hydrated: query.isFetched,
  };
}
