import { useQuery } from '@tanstack/react-query';

import { fetchAppSetting, type AppSettingKey } from '@/data/appSettingsRepository';

/**
 * An app_settings switch; off while loading. Polled every minute while a
 * screen using it is mounted: tab screens stay mounted and the app has no
 * focus-based refetch, so staleTime alone would never pick up a change.
 */
export function useAppSetting(key: AppSettingKey): boolean {
  const { data } = useQuery({
    queryKey: ['appSetting', key],
    queryFn: () => fetchAppSetting(key),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  return data === true;
}
