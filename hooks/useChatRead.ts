import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { fetchChatLastReadAt, markChatRead } from '@/data/chatReadsRepository';
import { useAuth } from '@/hooks/useAuth';
import type { Message } from '@/types/guest';

interface ChatReadResult {
  /** Someone else wrote after you last opened the chat. */
  hasUnread: (messages: readonly Message[]) => boolean;
  markRead: () => void;
}

/** Unread state of one event's chat for the signed-in user. */
export function useChatRead(eventId: string): ChatReadResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const key = ['chatRead', eventId, userId] as const;

  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchChatLastReadAt(userId as string, eventId),
    enabled: userId !== null && eventId.length > 0,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () => markChatRead(eventId),
    onMutate: () => {
      // Hide the dot right away; the server time replaces it on success.
      queryClient.setQueryData(key, new Date().toISOString());
    },
    onSuccess: (readAt) => {
      queryClient.setQueryData(key, readAt);
      // Home's "new messages" pill for this event.
      void queryClient.invalidateQueries({ queryKey: ['unreadChats'] });
    },
    // Best-effort: worst case the dot shows again until the next open.
  });

  const lastReadAt = query.data;
  const hasUnread = useCallback(
    (messages: readonly Message[]) => {
      if (userId === null || lastReadAt === undefined) return false;
      // Compare as times: Postgres and JS format timestamps differently.
      const readMs = lastReadAt === null ? -Infinity : Date.parse(lastReadAt);
      return messages.some((message) => message.sender_id !== userId && Date.parse(message.created_at) > readMs);
    },
    [userId, lastReadAt],
  );

  const { mutate } = mutation;
  const markRead = useCallback(() => {
    if (userId !== null && eventId.length > 0) mutate();
  }, [userId, eventId, mutate]);

  return { hasUnread, markRead };
}
