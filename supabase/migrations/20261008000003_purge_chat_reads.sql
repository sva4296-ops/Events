-- Keep chat_reads small: it holds one row per (person, event), never per
-- message, but rows outlive their use. The daily chat purge
-- (20261007000002_purge_chat_after_event.sql) now also deletes them:
--   - for finished events (their messages are already deleted, Chat is hidden);
--   - for people no longer in that chat (guest removed, declined or still
--     pending, co-organizer removed).
-- Deleted events and accounts already cascade.

create or replace function public.purge_finished_event_chats()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.messages m
  using public.events e
  where m.event_id = e.id
    and e.event_date is not null
    and e.event_date < (now() at time zone 'Europe/Bucharest')::date;

  delete from public.chat_reads cr
  using public.events e
  where cr.event_id = e.id
    and (
      (e.event_date is not null and e.event_date < (now() at time zone 'Europe/Bucharest')::date)
      or not (
        e.organizer_id = cr.user_id
        or exists (
          select 1 from public.event_members m
          where m.event_id = cr.event_id and m.user_id = cr.user_id and m.role = 'co_organizer'
        )
        or exists (
          select 1 from public.event_guests g
          where g.event_id = cr.event_id and g.guest_user_id = cr.user_id and g.rsvp_status = 'confirmed'
        )
      )
    );
$$;

revoke all on function public.purge_finished_event_chats() from public, anon, authenticated;

-- Same daily job (purge-finished-event-chats, 00:15 UTC) runs the new body.
-- Clean up what's already there.
select public.purge_finished_event_chats();
