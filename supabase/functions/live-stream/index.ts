// Live video (demo). Organizer-only.
//
// POST { eventId, action }:
//   'start' -> creates (or reuses) the event's Cloudflare Stream live input and
//              returns { whipUrl } for the broadcaster page. is_live stays false
//              until the page actually connects.
//   'live'  -> marks the stream live (called by the app once WHIP connected).
//   'stop'  -> marks it not live.
//   'share' -> makes sure the event has a stream row and returns { shareToken }
//              for the public watch link (povestea-web /w/<token>).
//
// Secrets: supabase secrets set CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_STREAM_TOKEN=...
// (API token with "Stream: Edit"). Deploy: supabase functions deploy live-stream

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface LiveInput {
  uid: string;
  webRTC?: { url?: string };
  webRTCPlayback?: { url?: string };
}

async function cloudflare(path: string, init: RequestInit = {}): Promise<{ status: number; input: LiveInput | null }> {
  const account = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? '';
  const token = Deno.env.get('CLOUDFLARE_STREAM_TOKEN') ?? '';
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/stream/live_inputs${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) return { status: res.status, input: null };
  const body = (await res.json()) as { result?: LiveInput };
  return { status: res.status, input: body.result ?? null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (jwt.length === 0) return json({ error: 'unauthorized' }, 401);

  let eventId = '';
  let action = '';
  try {
    const body = (await req.json()) as { eventId?: unknown; action?: unknown };
    eventId = typeof body.eventId === 'string' ? body.eventId : '';
    action = typeof body.action === 'string' ? body.action : '';
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  if (!UUID.test(eventId) || !['start', 'live', 'stop', 'share'].includes(action)) {
    return json({ error: 'bad_request' }, 400);
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';

  // Organizer check runs as the caller, through the same helper RLS uses.
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: isOrganizer, error: roleError } = await asUser.rpc('is_event_organizer', { target_event: eventId });
  if (roleError) return json({ error: roleError.message }, 500);
  if (isOrganizer !== true) return json({ error: 'forbidden' }, 403);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'live' || action === 'stop') {
    const { error } = await admin
      .from('event_streams')
      .update({ is_live: action === 'live', updated_at: new Date().toISOString() })
      .eq('event_id', eventId);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true }, 200);
  }

  // start / share: reuse the event's input if Cloudflare still has it, else create one.
  const { data: row, error: rowError } = await admin
    .from('event_streams')
    .select('input_uid, share_token')
    .eq('event_id', eventId)
    .maybeSingle();
  if (rowError) return json({ error: rowError.message }, 500);

  if (action === 'share' && row !== null) {
    return json({ shareToken: row.share_token as string }, 200);
  }

  let input: LiveInput | null = null;
  if (row !== null) {
    input = (await cloudflare(`/${row.input_uid as string}`)).input;
  }
  if (input === null) {
    const created = await cloudflare('', {
      method: 'POST',
      body: JSON.stringify({ meta: { name: `event-${eventId}` }, recording: { mode: 'off' } }),
    });
    if (created.input === null) return json({ error: `cloudflare_${created.status}` }, 502);
    input = created.input;
  }

  const whipUrl = input.webRTC?.url;
  const whepUrl = input.webRTCPlayback?.url;
  if (whipUrl === undefined || whepUrl === undefined) return json({ error: 'cloudflare_no_webrtc' }, 502);

  // share_token is left out: generated on insert, kept on update.
  const { data: saved, error: upsertError } = await admin
    .from('event_streams')
    .upsert({
      event_id: eventId,
      input_uid: input.uid,
      whep_url: whepUrl,
      is_live: false,
      updated_at: new Date().toISOString(),
    })
    .select('share_token')
    .single();
  if (upsertError) return json({ error: upsertError.message }, 500);

  if (action === 'share') return json({ shareToken: saved.share_token as string }, 200);
  return json({ whipUrl }, 200);
});
