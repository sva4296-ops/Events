-- Tell an open chat that someone took back a reaction, without the chat
-- listening to postgres_changes DELETEs on message_reactions: those can't be
-- filtered and skip RLS, so every un-react anywhere reached every open chat in
-- the app (one billed message per person with any chat open).
--
-- Instead the trigger sends a Broadcast on the event's private topic
-- `chat:<event_id>`, which only people who can see that event may receive.
-- Cost per un-react: 1 sent + 1 per person with that chat open.

-- Only people who can view the event may receive its chat topic. The CASE keeps
-- a malformed topic from reaching the uuid cast.
drop policy if exists "receive chat broadcasts of visible events" on realtime.messages;
create policy "receive chat broadcasts of visible events"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and case
      when realtime.topic() ~ '^chat:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.can_view_event(substr(realtime.topic(), 6)::uuid)
      else false
    end
  );

create or replace function public.notify_reaction_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip cascades (a deleted message or event takes its reactions with it):
  -- those come from the foreign-key trigger, one level down, and the screen
  -- already learns about the message going away on its own.
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  begin
    perform realtime.send(
      jsonb_build_object('reaction_id', old.id, 'message_id', old.message_id),
      'reaction_removed',
      'chat:' || old.event_id::text,
      true
    );
  exception when others then
    -- Never let a Realtime hiccup block removing a reaction.
    null;
  end;
  return old;
end;
$$;

revoke all on function public.notify_reaction_removed() from public, anon, authenticated;

drop trigger if exists on_message_reaction_removed_notify on public.message_reactions;
create trigger on_message_reaction_removed_notify
  after delete on public.message_reactions
  for each row execute function public.notify_reaction_removed();
