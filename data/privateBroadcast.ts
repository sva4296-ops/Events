import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/data/supabaseClient';

type Listener = (payload: unknown) => void;

interface SharedChannel {
  channel: RealtimeChannel;
  listeners: Set<Listener>;
  teardown: ReturnType<typeof setTimeout> | null;
}

/** Keyed by `${topic}|${event}`. */
const channels = new Map<string, SharedChannel>();
/** Teardown waits a bit: a quick remount (leaving and reopening a screen, Fast
 * Refresh) would otherwise ask for a channel that is still being removed, and
 * supabase-js hands back that same dying channel for a repeated name. */
const TEARDOWN_DELAY_MS = 5_000;

/**
 * Listens to one Broadcast event on a private Realtime topic. A private
 * channel's name must be the topic its RLS policy checks, so it can't be made
 * unique per mount: every caller for the same topic shares one channel, and it
 * is removed a few seconds after the last listener leaves.
 */
export function listenToPrivateBroadcast(topic: string, event: string, listener: Listener): () => void {
  const key = `${topic}|${event}`;
  let shared = channels.get(key);
  if (shared === undefined) {
    const listeners = new Set<Listener>();
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on('broadcast', { event }, ({ payload }) => listeners.forEach((notify) => notify(payload)))
      .subscribe();
    shared = { channel, listeners, teardown: null };
    channels.set(key, shared);
  }
  const current = shared;
  if (current.teardown !== null) {
    clearTimeout(current.teardown);
    current.teardown = null;
  }
  current.listeners.add(listener);
  return () => {
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    if (current.teardown !== null) clearTimeout(current.teardown);
    current.teardown = setTimeout(() => {
      current.teardown = null;
      if (current.listeners.size === 0 && channels.get(key) === current) {
        channels.delete(key);
        void supabase.removeChannel(current.channel);
      }
    }, TEARDOWN_DELAY_MS);
  };
}
