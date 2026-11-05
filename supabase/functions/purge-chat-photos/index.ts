// Deletes chat messages with a photo, and their files, once the event is over
// (same rule and reason as public.purge_finished_event_chats, which handles the
// text-only messages but can't touch Storage). Called daily by pg_cron, see
// 20261102000001_chat_photos.sql.
//
// Deploy: supabase functions deploy purge-chat-photos --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const PHOTO_BUCKET = 'event-photos';
const BATCH = 500;

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  // en-CA formats as YYYY-MM-DD.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());
  let purged = 0;

  for (;;) {
    const { data, error } = await admin
      .from('messages')
      .select('id, event_id, events!inner(event_date)')
      .not('photo_width', 'is', null)
      .lt('events.event_date', today)
      .limit(BATCH);
    if (error) return new Response(error.message, { status: 500 });
    if (data.length === 0) break;

    const paths = data.flatMap((row) => [
      `${row.event_id}/chat/${row.id}/thumb.jpg`,
      `${row.event_id}/chat/${row.id}/full.jpg`,
    ]);
    // Rows stay if this fails, so the next run retries the files.
    const { error: removeError } = await admin.storage.from(PHOTO_BUCKET).remove(paths);
    if (removeError) return new Response(removeError.message, { status: 500 });

    const { error: deleteError } = await admin
      .from('messages')
      .delete()
      .in('id', data.map((row) => row.id));
    if (deleteError) return new Response(deleteError.message, { status: 500 });

    purged += data.length;
  }

  return Response.json({ purged });
});
