-- Tell a guest (or co-organizer) the moment they're removed from an event, so
-- an open event screen can send them back to Home (hooks/useKickWhenRemoved.ts).
--
-- Sent as a Realtime Broadcast on the removed user's own private topic,
-- `user:<user_id>`, instead of listening to postgres_changes DELETEs: those
-- can't be filtered and reach every subscriber, so each removal would cost one
-- message per person with any event open. A per-event topic gated on event
-- access wouldn't work either: the removed user loses that access in the same
-- delete.

-- Only the user themself may receive their own topic.
drop policy if exists "receive own user broadcasts" on realtime.messages;
create policy "receive own user broadcasts"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and realtime.topic() = 'user:' || (select auth.uid())::text
  );

create or replace function public.notify_guest_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.guest_user_id is not null then
    begin
      perform realtime.send(
        jsonb_build_object('event_id', old.event_id),
        'removed_from_event',
        'user:' || old.guest_user_id::text,
        true
      );
    exception when others then
      -- Never let a Realtime hiccup block removing a guest.
      null;
    end;
  end if;
  return old;
end;
$$;

revoke all on function public.notify_guest_removed() from public, anon, authenticated;

drop trigger if exists on_event_guest_removed_notify on public.event_guests;
create trigger on_event_guest_removed_notify
  after delete on public.event_guests
  for each row execute function public.notify_guest_removed();
