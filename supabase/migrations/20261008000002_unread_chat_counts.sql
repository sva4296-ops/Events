-- Unread chat counts for Home's event cards (a "3 mesaje noi" pill), so new
-- messages show without opening each event. Based on chat_reads from
-- 20261008000001_chat_push.sql.

-- Start everyone at zero: without this, every existing message would count
-- as unread for anyone who never opened that chat.
insert into public.chat_reads (user_id, event_id, last_read_at)
select c.uid, e.id, now()
from public.events e
cross join lateral unnest(public.confirmed_guest_ids(e.id) || public.event_organizer_ids(e.id)) as c(uid)
where c.uid is not null
on conflict (user_id, event_id) do update
  set last_read_at = coalesce(public.chat_reads.last_read_at, excluded.last_read_at);

-- Per event the caller can chat in (organizer or confirmed guest): messages
-- from others since they last opened that chat. Only events with unread > 0.
create or replace function public.my_unread_chat_counts()
returns table (event_id uuid, unread int)
language sql
stable
security definer
set search_path = public
as $$
  select m.event_id, count(*)::int
  from public.messages m
  left join public.chat_reads cr
    on cr.user_id = auth.uid() and cr.event_id = m.event_id
  where auth.uid() is not null
    and m.sender_id <> auth.uid()
    and (cr.last_read_at is null or m.created_at > cr.last_read_at)
    and (
      public.is_event_organizer(m.event_id)
      or exists (
        select 1 from public.event_guests g
        where g.event_id = m.event_id
          and g.guest_user_id = auth.uid()
          and g.rsvp_status = 'confirmed'
      )
    )
  group by m.event_id;
$$;

revoke all on function public.my_unread_chat_counts() from public, anon;
grant execute on function public.my_unread_chat_counts() to authenticated;
