-- PovesteaNoastra — bulk guest invites (manual rows + contacts import) and a
-- "sent via WhatsApp" queue, distinct from just having a guest's phone/name
-- on file.
--
-- Two corrections to what was asked for, both because event_guests already
-- has different, real state occupying the requested names — see CLAUDE.md
-- §3 "Bulk guest invites" for the full reasoning:
--
-- 1. `invited_at timestamptz not null default now()` already exists
--    (20260810000001_initial_schema.sql) and means "when this event_guests
--    row was created," set automatically by every existing insert path,
--    never null. Reusing that column for "when the organizer tapped Send
--    via WhatsApp" would silently break its existing meaning and would make
--    a `whatsapp_sent_at is null` pending-queue filter never match anything
--    (the column is NOT NULL). New column instead: `whatsapp_sent_at`,
--    nullable, no default — set only by the send-invites queue screen.
-- 2. A unique index on (event_id, guest_phone) already exists
--    (20260818000002_guest_phone_invites.sql, event_guests_unique_phone) —
--    but it's a *partial* index (`where guest_phone is not null`), which
--    Postgres can't use as an ON CONFLICT arbiter for a plain
--    `.upsert(rows, { onConflict: 'event_id,guest_phone' })` call from
--    supabase-js (there's no client-side way to express the partial
--    predicate). Adding a real, non-partial UNIQUE constraint on the same
--    two columns instead — safe to add unconditionally: standard SQL treats
--    every NULL guest_phone as distinct from every other NULL, and the
--    existing partial index already guarantees no non-null duplicates exist
--    that could violate it.

alter table public.event_guests
  add column if not exists whatsapp_sent_at timestamptz;

alter table public.event_guests
  add constraint event_guests_event_phone_key unique (event_id, guest_phone);

-- ---------------------------------------------------------------------------
-- upsert_event_guests_batch — the actual batch-save call from
-- app/bulk-add-guests/[id].tsx.
--
-- Not a plain client-side .upsert(): a naive upsert overwrites every column
-- in the payload on conflict, which would (a) reset rsvp_status back to
-- 'pending' for a guest who already responded, and (b) null out an
-- existing guest_name whenever the organizer re-submits the same phone
-- number without typing a name again. Neither is acceptable — re-adding a
-- phone that's already invited should only ever refresh the name (and only
-- when a non-blank one is given), never touch rsvp_status.
--
-- security invoker (not definer): runs as the calling user, so the
-- existing "organizer manages own event's guest list" RLS policies apply
-- normally — no new access is granted beyond what an organizer's session
-- already has via .insert()/.update() on this table.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_event_guests_batch(p_event_id uuid, p_guests jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.event_guests (event_id, guest_phone, guest_name)
  select
    p_event_id,
    g ->> 'phone',
    nullif(g ->> 'name', '')
  from jsonb_array_elements(p_guests) as g
  on conflict (event_id, guest_phone) do update
  set guest_name = coalesce(excluded.guest_name, public.event_guests.guest_name);
end;
$$;

grant execute on function public.upsert_event_guests_batch(uuid, jsonb) to authenticated;
