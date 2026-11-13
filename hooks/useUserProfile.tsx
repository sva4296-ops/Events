import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  bumpAvatarVersion,
  fetchMyAvatar,
  fetchMyProfile,
  saveContactEmail,
  saveUserName,
  uploadUserAvatar,
} from '@/data/usersRepository';
import { useAuth } from '@/hooks/useAuth';

interface UserProfileResult {
  firstName: string | null;
  lastName: string | null;
  /** Prefer this over user.email/user.phone anywhere the UI shows "who is
   * this" — falls back to null (never to email/phone itself; callers already
   * have those on useAuth().user for their own last-resort fallback). */
  displayName: string | null;
  /** Optional contact info the user can fill in from Profile — not an auth
   * identifier, never verified. See app/edit-profile.tsx and saveEmail. */
  email: string | null;
  /** Signed URL for the private avatars bucket, or null if none uploaded
   * yet — see data/usersRepository.ts's fetchMyAvatar. Its own query, so a slow
   * signing call never holds up the name (and through it, the splash). */
  avatarUrl: string | null;
  /** Pass to expo-image with avatarUrl, so restarts don't download it again. */
  avatarCacheKey: string | null;
  /** False until the initial fetch completes — AuthGate's name-step redirect
   * waits on this so it doesn't fire on stale/absent data. */
  hydrated: boolean;
  saveName: (firstName: string, lastName: string) => Promise<void>;
  /** Pass null to clear the field back to blank. */
  saveEmail: (email: string | null) => Promise<void>;
  /** `localUri` should already be resized (utils/imageProcessing.ts's
   * processAvatarPhoto) — app/profile.tsx is the only caller. */
  uploadAvatar: (localUri: string) => Promise<void>;
}

/**
 * Plain hook, react-query backed — same shape as useAgency, no
 * Context/Provider. `saveName`/`saveEmail` are called from
 * app/edit-profile.tsx — first/last name is otherwise set once, at signup,
 * via raw_user_meta_data; email is never set anywhere else, since phone-only
 * auth means there's no signup-time email to seed it from. Also read by
 * app/profile.tsx and the guest/organizer identity fallbacks in
 * useEvents/useEventContent.
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

  const avatarQueryKey = ['userAvatar', userId] as const;
  const avatarQuery = useQuery({
    queryKey: avatarQueryKey,
    queryFn: () => fetchMyAvatar(userId as string),
    enabled: userId !== null,
    staleTime: 30 * 60_000,
  });

  const saveNameMutation = useMutation({
    mutationFn: (vars: { firstName: string; lastName: string }) => {
      if (userId === null) throw new Error('Not signed in.');
      return saveUserName(userId, vars.firstName, vars.lastName);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const saveEmailMutation = useMutation({
    mutationFn: (email: string | null) => {
      if (userId === null) throw new Error('Not signed in.');
      return saveContactEmail(userId, email);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (localUri: string) => {
      if (userId === null) throw new Error('Not signed in.');
      await uploadUserAvatar(userId, localUri);
      await bumpAvatarVersion(userId);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: avatarQueryKey }),
  });

  return {
    firstName: query.data?.firstName ?? null,
    lastName: query.data?.lastName ?? null,
    displayName: query.data?.displayName ?? null,
    email: query.data?.email ?? null,
    avatarUrl: avatarQuery.data?.url ?? null,
    avatarCacheKey: avatarQuery.data?.cacheKey ?? null,
    hydrated: userId === null ? true : query.isFetched,
    saveName: async (firstName, lastName) => {
      await saveNameMutation.mutateAsync({ firstName, lastName });
    },
    saveEmail: async (email) => {
      await saveEmailMutation.mutateAsync(email);
    },
    uploadAvatar: async (localUri) => {
      await uploadAvatarMutation.mutateAsync(localUri);
    },
  };
}
