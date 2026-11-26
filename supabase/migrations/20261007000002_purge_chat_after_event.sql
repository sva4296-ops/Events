-- Chat messages are deleted once the event is over (GDPR: storage limitation).
-- The app already hides Chat for finished events (archive mode: only Acasă and
-- Album), so nothing visible is lost. "Over" = the day after event_date in
-- Europe/Bucharest, the same rule the app uses (utils/format.ts isEventPast).
-- Events without a date keep their chat until they get one.

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
$$;

revoke all on function public.purge_finished_event_chats() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

-- 00:15 UTC = 02:15 / 03:15 in Romania: just after the event's day has ended.
select cron.unschedule('purge-finished-event-chats')
where exists (select 1 from cron.job where jobname = 'purge-finished-event-chats');

select cron.schedule(
  'purge-finished-event-chats',
  '15 0 * * *',
  $$ select public.purge_finished_event_chats(); $$
);

-- Clean up chats of events that are already over.
select public.purge_finished_event_chats();
