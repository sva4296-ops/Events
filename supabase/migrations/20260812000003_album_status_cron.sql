-- Scheduled not_started -> generating -> ready transition for
-- events.album_status. v1's "compile" step is a no-op: full-quality photo
-- versions are already uploaded per-photo at capture time and addressed by
-- convention (event_id/photo_id/full.jpg — see CLAUDE.md's "Photo uploads"
-- section), so there is nothing to actually generate yet, just a status
-- flip. Plain SQL, not an Edge Function: pg_cron calling a plpgsql function
-- directly needs no pg_net extension, no secrets, and no deploy step, for
-- work this simple. Swap in an Edge Function later if v2's real compile
-- work (dedupe/quality filtering) needs a runtime Postgres can't provide —
-- nothing here would need restructuring, just the second update below
-- replaced with "only rows whose real compile work has actually finished."
--
-- Grace period cutoff: 72 hours after midnight at the start of event_date,
-- in the database's timezone (UTC on Supabase). event_date has no
-- time-of-day or timezone recorded anywhere in the schema, so this is an
-- approximation of "72h after the event actually ended," not a precise
-- measurement — an evening event's true end could already be well past this
-- cutoff. Flagged, not silently assumed precise.
create or replace function public.advance_album_status()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.events
  set album_status = 'generating'
  where album_status = 'not_started'
    and event_date is not null
    and event_date + interval '72 hours' < now();

  -- Immediate in v1 — kept as its own statement, not folded into the update
  -- above, purely so v2 can insert a real waiting period between the two
  -- states later without restructuring this function.
  update public.events
  set album_status = 'ready'
  where album_status = 'generating';
end;
$$;

-- SECURITY DEFINER bypasses RLS on purpose — pg_cron has no authenticated
-- request context, so there is no auth.uid() for the "organizer updates own
-- event" policy to match against. Revoking PUBLIC execute is the actual
-- safeguard: without it, any signed-in client could call
-- rpc('advance_album_status') and force-flip an arbitrary event's status
-- early, since a SECURITY DEFINER function runs with its owner's privilege
-- regardless of who invokes it. Same posture as reset_test_data() (see
-- 20260810000005_reset_test_data_fn.sql) — nobody needs a direct grant here
-- either, since pg_cron runs scheduled jobs as the role that created them
-- (the migration-running role, which already owns this function).
revoke all on function public.advance_album_status() from public;

create extension if not exists pg_cron with schema extensions;

-- Every 6 hours, not daily: the 72h cutoff above is already an
-- approximation (see the function's own comment), so a once-daily job could
-- silently add up to ~24h of pure scheduling latency on top of that before
-- a guest whose grace period already lapsed actually sees 'ready'. This
-- keeps that added latency to at most 6h for negligible extra cost — the
-- job only ever scans the small partial index from 20260812000002, nothing
-- proportional to total event volume.
select cron.schedule(
  'advance-album-status',
  '0 */6 * * *',
  $$ select public.advance_album_status(); $$
);
