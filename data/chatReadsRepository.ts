import { supabase } from '@/data/supabaseClient';

/**
 * When the signed-in user last opened an event's chat (chat_reads, see
 * supabase/migrations/20261008000001_chat_push.sql). Drives the unread dot on
 * the Chat tab and resets the "one push per unread batch" chat notifications.
 */
export async function fetchChatLastReadAt(userId: string, eventId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('chat_reads')
    .select('last_read_at')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  return (data as { last_read_at: string | null } | null)?.last_read_at ?? null;
}

/** Returns the server's "read at" time. */
export async function markChatRead(eventId: string): Promise<string> {
  const { data, error } = await supabase.rpc('mark_chat_read', { p_event_id: eventId });
  if (error) throw error;
  return data as string;
}

/** Event id -> unread messages, for every event with at least one. */
export async function fetchUnreadChatCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('my_unread_chat_counts');
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const row of (data ?? []) as { event_id: string; unread: number }[]) {
    result[row.event_id] = row.unread;
  }
  return result;
}
