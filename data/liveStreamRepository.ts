import { supabase } from '@/data/supabaseClient';

/**
 * Live video (demo): event_streams + the live-stream Edge Function.
 * See supabase/migrations/20261002000004_event_streams.sql.
 */

export interface EventStream {
  whepUrl: string;
  isLive: boolean;
}

export async function fetchEventStream(eventId: string): Promise<EventStream | null> {
  const { data, error } = await supabase
    .from('event_streams')
    .select('whep_url, is_live')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  const row = data as { whep_url: string; is_live: boolean };
  return { whepUrl: row.whep_url, isLive: row.is_live };
}

async function callLiveStream(eventId: string, action: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.functions.invoke('live-stream', {
    method: 'POST',
    body: { eventId, action },
  });
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

/** Organizer only (checked by the function). 'start' resolves to the WHIP url. */
export async function invokeLiveStream(
  eventId: string,
  action: 'start' | 'live' | 'stop',
): Promise<string | null> {
  const whipUrl = (await callLiveStream(eventId, action))?.whipUrl;
  return typeof whipUrl === 'string' ? whipUrl : null;
}

/** Organizer only. Token for the public watch link (povestea-web /w/<token>). */
export async function fetchLiveShareToken(eventId: string): Promise<string> {
  const token = (await callLiveStream(eventId, 'share'))?.shareToken;
  if (typeof token !== 'string') throw new Error('no_share_token');
  return token;
}
