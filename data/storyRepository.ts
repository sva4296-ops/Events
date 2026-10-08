import { supabase } from '@/data/supabaseClient';

/** Confirmed guests of an event, counted server-side (guests only see their own row). */
export async function fetchStoryConfirmedGuests(eventId: string): Promise<number> {
  const { data, error } = await supabase.rpc('event_story_confirmed_guests', { p_event_id: eventId });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}
