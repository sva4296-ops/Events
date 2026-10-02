-- Push to guests when the organizer deletes an event ("Anulat: <name>").
--
-- BEFORE DELETE so event_guests is still readable (the cascade removes it
-- right after). Recipients: guests with an account who haven't declined
-- (confirmed + pending). Skipped once the event date is in the past
-- (Europe/Bucharest): deleting an old event is cleanup, not a cancellation.
-- The pg_net request is queued inside the same transaction, so a delete that
-- fails sends nothing. Tapping opens Home ('/'), since the event is gone.
-- Same sender as 20261001000002_push_notifications.sql (send_expo_push).

create or replace function public.notify_guests_on_event_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipients uuid[];
begin
  if old.event_date is not null
     and old.event_date < (now() at time zone 'Europe/Bucharest')::date then
    return old;
  end if;

  select coalesce(array_agg(guest_user_id), '{}')
    into recipients
  from public.event_guests
  where event_id = old.id
    and guest_user_id is not null
    and rsvp_status <> 'declined';

  if cardinality(recipients) > 0 then
    perform public.send_expo_push(
      recipients,
      'Anulat: ' || old.name,
      'Organizatorul a anulat evenimentul. Invitația nu mai este valabilă.',
      jsonb_build_object('url', '/')
    );
  end if;
  return old;
end;
$$;

revoke all on function public.notify_guests_on_event_delete() from public, anon, authenticated;

drop trigger if exists on_event_delete_notify on public.events;
create trigger on_event_delete_notify
  before delete on public.events
  for each row execute function public.notify_guests_on_event_delete();
