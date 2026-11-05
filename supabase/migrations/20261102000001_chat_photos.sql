-- Photos in the event chat. One photo per message: the files live in the
-- existing event-photos bucket at {eventId}/chat/{messageId}/thumb|full.jpg
-- (same convention as `photos`: paths derive from the ids, and the bucket's
-- policies already key on the first path segment). photo_width is what marks a
-- message as having a photo; the size lets the bubble reserve its height before
-- the image loads. A photo without a caption has content = ''.

alter table public.messages
  add column if not exists photo_width int check (photo_width > 0),
  add column if not exists photo_height int check (photo_height > 0);

alter table public.messages drop constraint if exists messages_photo_size_check;
alter table public.messages
  add constraint messages_photo_size_check check ((photo_width is null) = (photo_height is null));

-- ---------------------------------------------------------------------------
-- Push preview for a photo without a caption
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_name text;
  preview text;
  preview_en text;
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
  preview_en := preview;
  -- A photo sent without a caption has no text to preview.
  if preview = '' then
    preview := '📷 Poză';
    preview_en := '📷 Photo';
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
      jsonb_build_object('title', 'New messages in ' || ev_name, 'body', new.sender_label || ': ' || preview_en)
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

-- ---------------------------------------------------------------------------
-- Daily purge: messages with a photo are left to the purge-chat-photos edge
-- function. Postgres can't delete Storage files, and deleting the row first
-- would lose track of them.
-- ---------------------------------------------------------------------------
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
    and e.event_date < (now() at time zone 'Europe/Bucharest')::date
    and m.photo_width is null;

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

-- ---------------------------------------------------------------------------
-- Runs the edge function right after the daily purge. Needs two Vault secrets:
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<random>', 'cron_secret');
-- plus: supabase secrets set CRON_SECRET=<same random>
-- ---------------------------------------------------------------------------
select cron.unschedule('purge-chat-photos')
where exists (select 1 from cron.job where jobname = 'purge-chat-photos');

select cron.schedule(
  'purge-chat-photos',
  '30 0 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-chat-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    )
  );
  $$
);
