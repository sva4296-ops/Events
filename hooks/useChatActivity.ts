import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/data/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import type { MessageRow } from '@/types/supabase';
import { generateId } from '@/utils/uuid';

const REFRESH_DELAY_MS = 800;

/**
 * Live "new messages" while the app is open: one Realtime subscription to
 * message inserts (RLS limits it to chats the user can see). Each insert from
 * someone else refreshes Home's unread pills and that event's chat data, so
 * the Chat tab's dot shows up too, without waiting for a push (only the first
 * message of a batch gets one, and iOS has none yet).
 *
 * Mounted on Home, which stays mounted under every other screen.
 */
export function useChatActivity(): void {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (userId === null) return;

    // A burst of messages = one refresh.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const touchedEvents = new Set<string>();
    const flush = () => {
      timer = null;
      void queryClient.invalidateQueries({ queryKey: ['unreadChats'] });
      for (const eventId of touchedEvents) {
        void queryClient.invalidateQueries({ queryKey: ['eventContent', 'social', eventId] });
      }
      touchedEvents.clear();
    };

    // Unique topic: see the same note in app/guest/[id]/chat.tsx.
    const channel = supabase
      .channel(`chat-activity:${userId}:${generateId()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const row = payload.new as MessageRow;
        if (row.sender_id === userId) return;
        touchedEvents.add(row.event_id);
        if (timer === null) timer = setTimeout(flush, REFRESH_DELAY_MS);
      })
      .subscribe();

    return () => {
      if (timer !== null) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}
