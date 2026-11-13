import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchNotificationPreferences,
  fetchNotificationTypes,
  saveNotificationPreference,
  type NotificationType,
} from '@/data/notificationsRepository';
import { useAuth } from '@/hooks/useAuth';
import { reportSupabaseError } from '@/utils/reportError';

export interface NotificationSetting extends NotificationType {
  enabled: boolean;
}

interface NotificationPreferencesResult {
  settings: NotificationSetting[];
  hydrated: boolean;
  /** Loading the list failed (e.g. the migration isn't applied yet). */
  failed: boolean;
  retry: () => void;
  setEnabled: (type: NotificationType, enabled: boolean) => void;
}

/** Plain react-query hook (same shape as useUserProfile). Read by app/notifications.tsx. */
export function useNotificationPreferences(): NotificationPreferencesResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const prefsKey = ['notificationPrefs', userId] as const;

  // Seeded by a migration; changes only with a new migration.
  const typesQuery = useQuery({
    queryKey: ['notificationTypes'],
    queryFn: fetchNotificationTypes,
    staleTime: Infinity,
  });

  const prefsQuery = useQuery({
    queryKey: prefsKey,
    queryFn: () => fetchNotificationPreferences(userId as string),
    enabled: userId !== null,
    staleTime: 180_000,
  });

  const mutation = useMutation({
    mutationFn: (vars: { type: NotificationType; enabled: boolean }) => {
      if (userId === null) throw new Error('Not signed in.');
      return saveNotificationPreference(userId, vars.type, vars.enabled);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: prefsKey });
      queryClient.setQueryData<Record<string, boolean>>(prefsKey, (old) => ({
        ...(old ?? {}),
        [vars.type.key]: vars.enabled,
      }));
    },
    onError: (err) => {
      reportSupabaseError(err);
      void queryClient.invalidateQueries({ queryKey: prefsKey });
    },
  });

  const prefs = prefsQuery.data ?? {};
  const settings = (typesQuery.data ?? []).map((type) => ({
    ...type,
    enabled: type.locked ? true : (prefs[type.key] ?? type.defaultEnabled),
  }));

  return {
    settings,
    hydrated: typesQuery.data !== undefined && prefsQuery.data !== undefined,
    failed: typesQuery.isError || prefsQuery.isError,
    retry: () => {
      void typesQuery.refetch();
      void prefsQuery.refetch();
    },
    setEnabled: (type, enabled) => {
      if (type.locked) return;
      mutation.mutate({ type, enabled });
    },
  };
}
