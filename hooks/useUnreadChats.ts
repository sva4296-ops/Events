import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { fetchUnreadChatCounts } from '@/data/chatReadsRepository';
import { useAuth } from '@/hooks/useAuth';

/**
 * Unread chat messages per event, for Home's cards. Refreshed when a push
 * arrives (usePushNotifications), when a chat is marked read (useChatRead)
 * and when Home comes back into focus.
 */
export function useUnreadChats(): { unreadFor: (eventId: string) => number; refetch: () => void } {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const query = useQuery({
    queryKey: ['unreadChats', userId],
    queryFn: fetchUnreadChatCounts,
    enabled: userId !== null,
    staleTime: 30_000,
  });

  // Stable, so Home's focus effect doesn't re-run (and refetch) every render.
  const { refetch: refetchQuery } = query;
  const refetch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  return {
    unreadFor: (eventId) => query.data?.[eventId] ?? 0,
    refetch,
  };
}
