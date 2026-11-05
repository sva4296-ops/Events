-- Chat pushes without spam: one push per unread batch.
--
--   - New message -> each other member gets ONE push ("Mesaje noi în <event>",
--     "Bogdan: Cine vine cu mașina?"), then nothing more until they open the
--     chat again.
--   - Safety net: if they never open it, at most one reminder every 3 hours
--     ("5 mesaje noi de la ultima vizită").
--   - Opening (or leaving) the chat calls mark_chat_read(), which resets it.
--
-- Recipients: confirmed guests + owner and co-organizers, minus the sender,
-- filtered by the user's "chat_message" preference (send_notification,
-- 20261007000003_notification_preferences.sql). Chat on the plan is already
-- enforced at insert (enforce_chat_plan), so a message existing means chat is on.

-- ---------------------------------------------------------------------------
-- 1. Notification type (own "Chat" group in the notification center)
-- ---------------------------------------------------------------------------
alter table public.notification_types drop constraint if exists notification_types_category_check;
alter table public.notification_types
  add constraint notification_types_category_check
  check (category in ('organizer', 'reminders', 'updates', 'chat'));

insert into public.notification_types (key, category, default_enabled, locked, sort_order)
values ('chat_message', 'chat', true, false, 80)
on conflict (key) do update set
  category = excluded.category,
  default_enabled = excluded.default_enabled,
  locked = excluded.locked,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2. Read / notified state per user and event
-- ---------------------------------------------------------------------------
create table if not exists public.chat_reads (
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  -- Null = never opened this chat.
  last_read_at timestamptz,
  -- Null = never got a chat push for this event.
  last_notified_at timestamptz,
  primary key (user_id, event_id)
);

alter table public.chat_reads enable row level security;

-- Read your own row (unread dot on the Chat tab). Writes only through
-- mark_chat_read() and the trigger below.
drop policy if exists "users read own chat state" on public.chat_reads;
create policy "users read own chat state" on public.chat_reads
  for select using (user_id = auth.uid());

create or replace function public.mark_chat_read(p_event_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  read_at timestamptz := now();
begin
  if auth.uid() is null or not public.can_view_event(p_event_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  insert into public.chat_reads (user_id, event_id, last_read_at)
  values (auth.uid(), p_event_id, read_at)
  on conflict (user_id, event_id) do update set last_read_at = excluded.last_read_at;

  return read_at;
end;
$$;

revoke all on function public.mark_chat_read(uuid) from public, anon;
grant execute on function public.mark_chat_read(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sender
-- ---------------------------------------------------------------------------
-- Who can hear about a message: confirmed guests + organizers, minus the
-- sender, with their chat_reads state (null when they have no row yet).
create or replace function public.chat_push_candidates(p_event_id uuid, p_sender_id uuid)
returns table (uid uuid, last_read_at timestamptz, last_notified_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.uid, cr.last_read_at, cr.last_notified_at
  from (
    select distinct x.uid
    from unnest(public.confirmed_guest_ids(p_event_id) || public.event_organizer_ids(p_event_id)) as x(uid)
    where x.uid is not null and x.uid <> p_sender_id
  ) r
  left join public.chat_reads cr on cr.user_id = r.uid and cr.event_id = p_event_id;
$$;

revoke all on function public.chat_push_candidates(uuid, uuid) from public, anon, authenticated;

create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_name text;
  preview text;
  fresh_ids uuid[];
  reminder record;
  unread_count int;
begin
  select name into ev_name from public.events where id = new.event_id;
  if ev_name is null then
    return new;
  end if;

  preview := left(regexp_replace(trim(new.content), '\s+', ' ', 'g'), 100);
  if length(trim(new.content)) > 100 then
    preview := preview || '…';
  end if;

  -- Everyone who should hear about it, with their read / notified state.
  -- a) Fresh: never notified, or opened the chat since the last push.
  select coalesce(array_agg(c.uid), '{}') into fresh_ids
  from public.chat_push_candidates(new.event_id, new.sender_id) c
  where c.last_notified_at is null
     or (c.last_read_at is not null and c.last_read_at >= c.last_notified_at);

  if cardinality(fresh_ids) > 0 then
    perform public.send_notification(
      fresh_ids,
      'chat_message',
      jsonb_build_object('url', '/guest/' || new.event_id || '/chat', 'event_id', new.event_id),
      jsonb_build_object('title', 'Mesaje noi în ' || ev_name, 'body', new.sender_label || ': ' || preview),
      jsonb_build_object('title', 'New messages in ' || ev_name, 'body', new.sender_label || ': ' || preview)
    );
  end if;

  -- b) Reminder: notified, still hasn't opened it, last push over 3 hours ago.
  --    One by one, because the unread count differs per person.
  for reminder in
    select c.uid, c.last_read_at
    from public.chat_push_candidates(new.event_id, new.sender_id) c
    where c.last_notified_at is not null
      and (c.last_read_at is null or c.last_read_at < c.last_notified_at)
      and c.last_notified_at < now() - interval '3 hours'
  loop
    select count(*) into unread_count
    from public.messages m
    where m.event_id = new.event_id
      and m.sender_id <> reminder.uid
      and (reminder.last_read_at is null or m.created_at > reminder.last_read_at);

    perform public.send_notification(
      array[reminder.uid],
      'chat_message',
      jsonb_build_object('url', '/guest/' || new.event_id || '/chat', 'event_id', new.event_id),
      jsonb_build_object(
        'title', 'Mesaje noi în ' || ev_name,
        'body', case when unread_count = 1 then '1 mesaj nou de la ultima vizită'
                     else unread_count || ' mesaje noi de la ultima vizită' end
      ),
      jsonb_build_object(
        'title', 'New messages in ' || ev_name,
        'body', case when unread_count = 1 then '1 new message since your last visit'
                     else unread_count || ' new messages since your last visit' end
      )
    );
    fresh_ids := fresh_ids || reminder.uid;
  end loop;

  -- Remember who was just notified (even if their preference filtered the
  -- push out: then they simply stay quiet, which is what they asked for).
  if cardinality(fresh_ids) > 0 then
    insert into public.chat_reads (user_id, event_id, last_notified_at)
    select uid, new.event_id, now() from unnest(fresh_ids) as x(uid)
    on conflict (user_id, event_id) do update set last_notified_at = excluded.last_notified_at;
  end if;

  return new;
end;
$$;

revoke all on function public.notify_on_chat_message() from public, anon, authenticated;

drop trigger if exists on_chat_message_notify on public.messages;
create trigger on_chat_message_notify
  after insert on public.messages
  for each row execute function public.notify_on_chat_message();
