-- Push notifications (Android first; iOS works the same once there's an Apple
-- account): device tokens + two server-side senders.
--
--   1. RSVP -> organizer: a guest confirms or declines (app, web token link,
--      or web signed-in) -> the organizer's devices get a push.
--   2. Reminder: daily pg_cron job, the day before event_date, to every
--      confirmed guest.
--
-- Delivery goes straight from Postgres to Expo's push API via pg_net (async,
-- fire-and-forget, never blocks or fails the RSVP write). No Edge Function,
-- no secrets: Expo's send endpoint needs no access token unless "enhanced
-- push security" is turned on in the Expo dashboard. If it ever is, add an
-- Authorization header in send_expo_push() below and nothing else changes.
-- Message text is Romanian; there's no per-user language stored server-side.

create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Tokens
-- ---------------------------------------------------------------------------
create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

-- RLS on with no policies: clients only ever go through the two RPCs below.
alter table public.push_tokens enable row level security;

-- Upsert keyed on the token: a device that signs in as another account moves
-- to that account instead of notifying both.
create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, updated_at = now();
end;
$$;

-- Called on sign-out, so a shared phone stops getting the old account's pushes.
create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
revoke all on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sender (internal only)
-- ---------------------------------------------------------------------------
-- One Expo push request per 100 tokens (Expo's batch limit). `p_data.url` is
-- the in-app route the notification opens (see utils/pushNotifications.ts).
create or replace function public.send_expo_push(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  batch jsonb;
begin
  for batch in
    select jsonb_agg(
             jsonb_build_object(
               'to', token,
               'title', p_title,
               'body', p_body,
               'data', p_data,
               'sound', 'default',
               'channelId', 'default'
             )
           )
    from (
      select token, (row_number() over (order by token) - 1) / 100 as chunk
      from public.push_tokens
      where user_id = any (p_user_ids)
    ) t
    group by chunk
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := batch,
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb
    );
  end loop;
end;
$$;

revoke all on function public.send_expo_push(uuid[], text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. RSVP -> organizer
-- ---------------------------------------------------------------------------
create or replace function public.notify_organizer_on_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  guest_label text;
begin
  if new.rsvp_status not in ('confirmed', 'declined') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.rsvp_status is not distinct from new.rsvp_status then
    return new;
  end if;

  select id, name, organizer_id into ev from public.events where id = new.event_id;
  if ev.id is null then
    return new;
  end if;

  select coalesce(nullif(trim(new.guest_name), ''), nullif(trim(u.display_name), ''), 'Un invitat')
    into guest_label
  from (select 1) one
  left join public.users u on u.id = new.guest_user_id;

  perform public.send_expo_push(
    array[ev.organizer_id],
    case when new.rsvp_status = 'confirmed'
      then guest_label || ' a confirmat'
      else guest_label || ' nu poate ajunge'
    end,
    ev.name,
    jsonb_build_object('url', '/event/' || ev.id)
  );
  return new;
end;
$$;

revoke all on function public.notify_organizer_on_rsvp() from public, anon, authenticated;

drop trigger if exists on_event_guest_rsvp_notify on public.event_guests;
create trigger on_event_guest_rsvp_notify
  after insert or update of rsvp_status on public.event_guests
  for each row execute function public.notify_organizer_on_rsvp();

-- ---------------------------------------------------------------------------
-- 2. Day-before reminder
-- ---------------------------------------------------------------------------
-- event_date has no time or timezone; "tomorrow" is computed in Romanian time.
create or replace function public.send_event_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  guest_ids uuid[];
begin
  for ev in
    select id, name, location
    from public.events
    where event_date = (now() at time zone 'Europe/Bucharest')::date + 1
  loop
    select array_agg(guest_user_id) into guest_ids
    from public.event_guests
    where event_id = ev.id and rsvp_status = 'confirmed' and guest_user_id is not null;

    if guest_ids is not null then
      perform public.send_expo_push(
        guest_ids,
        'Mâine: ' || ev.name,
        case when coalesce(trim(ev.location), '') <> ''
          then 'Ne vedem mâine la ' || trim(ev.location) || '.'
          else 'Ne vedem mâine!'
        end,
        jsonb_build_object('url', '/guest/' || ev.id)
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.send_event_reminders() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

-- 07:00 UTC = 10:00 in Romania in summer, 09:00 in winter.
select cron.schedule(
  'send-event-reminders',
  '0 7 * * *',
  $$ select public.send_event_reminders(); $$
);
