// Deletes the calling user's account and everything that belongs to it.
// Required by Google Play (in-app account deletion) and reused by
// povestea-web's /account page.
//
// Runs with the service role because two steps can't be done from a client
// session: Storage files under other people's prefixes (photos this user
// uploaded to someone else's event) and auth.admin.deleteUser().
//
// Order matters:
//   1. Collect Storage paths from the DB while the rows still exist.
//   2. Remove those files (best-effort, a leftover file is not a reason to
//      keep an account the user asked us to delete).
//   3. Delete this user's event_guests rows. Without this, deleting the user
//      would set guest_user_id to null (on delete set null) and, for a row
//      claimed in-app with no email/phone, violate event_guests_contact_check,
//      aborting the whole delete.
//   4. auth.admin.deleteUser(): cascades auth.users -> public.users -> events,
//      moments, messages, photos, reactions, agencies (all on delete cascade).
//
// Deploy: supabase functions deploy delete-account

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const PHOTO_BUCKET = 'event-photos';
const AVATAR_BUCKET = 'avatars';
const REMOVE_CHUNK = 500;

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (jwt.length === 0) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // The user id always comes from the verified token, never from the body.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || userData.user === null) return json({ error: 'unauthorized' }, 401);
  const userId = userData.user.id;

  // 1. Storage paths.
  const { data: ownedEvents, error: eventsError } = await admin
    .from('events')
    .select('id')
    .eq('organizer_id', userId);
  if (eventsError) return json({ error: eventsError.message }, 500);
  const ownedEventIds = (ownedEvents ?? []).map((row) => row.id as string);

  const photoFilter =
    ownedEventIds.length > 0
      ? `uploaded_by.eq.${userId},event_id.in.(${ownedEventIds.join(',')})`
      : `uploaded_by.eq.${userId}`;
  const { data: photos, error: photosError } = await admin
    .from('photos')
    .select('id, event_id')
    .or(photoFilter);
  if (photosError) return json({ error: photosError.message }, 500);

  const photoPaths: string[] = [];
  for (const photo of photos ?? []) {
    photoPaths.push(`${photo.event_id}/${photo.id}/thumb.jpg`, `${photo.event_id}/${photo.id}/full.jpg`);
  }

  if (ownedEventIds.length > 0) {
    const { data: moments, error: momentsError } = await admin
      .from('moments')
      .select('event_id, photo_url')
      .in('event_id', ownedEventIds);
    if (momentsError) return json({ error: momentsError.message }, 500);
    for (const moment of moments ?? []) {
      const path = moment.photo_url as string | null;
      // Legacy rows hold a device-local URI, not a Storage path.
      if (path !== null && path.startsWith(`${moment.event_id}/moments/`)) photoPaths.push(path);
    }

    // Menu course photos live inside menu_options.courses (jsonb).
    const { data: menuOptions, error: menuError } = await admin
      .from('menu_options')
      .select('event_id, courses')
      .in('event_id', ownedEventIds);
    if (menuError) return json({ error: menuError.message }, 500);
    for (const option of menuOptions ?? []) {
      const courses = Array.isArray(option.courses) ? (option.courses as { photo_path?: unknown }[]) : [];
      for (const course of courses) {
        const path = course?.photo_path;
        if (typeof path === 'string' && path.startsWith(`${option.event_id}/menu/`)) photoPaths.push(path);
      }
    }
  }

  // 2. Remove files (best-effort; .remove() reports per-path errors, never throws).
  for (let i = 0; i < photoPaths.length; i += REMOVE_CHUNK) {
    await admin.storage.from(PHOTO_BUCKET).remove(photoPaths.slice(i, i + REMOVE_CHUNK));
  }
  await admin.storage.from(AVATAR_BUCKET).remove([`${userId}/avatar.jpg`]);

  // 3. This user's own guest rows (see header comment).
  const { error: guestsError } = await admin.from('event_guests').delete().eq('guest_user_id', userId);
  if (guestsError) return json({ error: guestsError.message }, 500);

  // 4. The account itself; everything else cascades.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return json({ error: deleteError.message }, 500);

  return json({ deleted: true }, 200);
});
