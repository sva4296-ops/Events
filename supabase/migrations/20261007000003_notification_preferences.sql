-- Notification center (step 1):
--   1. A catalog of push types (notification_types) and per-user overrides
--      (notification_preferences). Absent row = the type's default.
--   2. send_notification(): the one entry point every sender uses now. It
--      drops users who switched that type off, then sends Romanian or English
--      copy per users.locale through the existing send_expo_push().
--   3. Push token hygiene: one token per app install (push_tokens.device_id)
--      and a daily prune of tokens not refreshed in 60 days.
--
-- Every sender below is redefined from its latest version
-- (20261001000002/3, 20261001000005, 20261002000002) with the same recipients
-- and logic; only the send call changed (type + RO/EN copy).

-- ---------------------------------------------------------------------------
-- 1. Catalog
-- ---------------------------------------------------------------------------
create table if not exists public.notification_types (
  key text primary key,
  category text not null check (category in ('organizer', 'reminders', 'updates')),
  default_enabled boolean not null default true,
  -- Locked types are always sent and can't be switched off.
  locked boolean not null default false,
  sort_order int not null default 0
);

alter table public.notification_types enable row level security;

drop policy if exists "anyone reads notification types" on public.notification_types;
create policy "anyone reads notification types" on public.notification_types
  for select using (true);

insert into public.notification_types (key, category, default_enabled, locked, sort_order) values
  ('rsvp_response',   'organizer', true, false, 10),
  ('event_reminder',  'reminders', true, false, 20),
  ('menu_reminder',   'reminders', true, false, 30),
  ('event_changed',   'updates',   true, false, 40),
  ('new_moment',      'updates',   true, false, 50),
  ('album_ready',     'updates',   true, false, 60),
  ('event_cancelled', 'updates',   true, true,  70)
on conflict (key) do update set
  category = excluded.category,
  default_enabled = excluded.default_enabled,
  locked = excluded.locked,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 2. Preferences (only rows that differ from the default are written)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null references public.notification_types (key) on delete cascade,
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);

alter table public.notification_preferences enable row level security;

drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Language for push copy. Written by the app (utils/pushNotifications.ts);
-- null = an install that hasn't synced yet, treated as Romanian (the old copy).
-- "users update own row" already covers it.
alter table public.users
  add column if not exists locale text check (locale in ('en', 'ro'));

create or replace function public.wants_notification(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select case when t.locked then true else coalesce(p.enabled, t.default_enabled) end
      from public.notification_types t
      left join public.notification_preferences p
        on p.type = t.key and p.user_id = p_user_id
      where t.key = p_type
    ),
    true -- unknown type: send rather than silently drop
  );
$$;

revoke all on function public.wants_notification(uuid, text) from public, anon, authenticated;

-- p_ro / p_en: {"title": ..., "body": ...}. p_en null = Romanian for everyone.
create or replace function public.send_notification(
  p_user_ids uuid[],
  p_type text,
  p_data jsonb,
  p_ro jsonb,
  p_en jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ro_ids uuid[];
  en_ids uuid[];
  payload jsonb := coalesce(p_data, '{}'::jsonb) || jsonb_build_object('type', p_type);
  en_copy jsonb := coalesce(p_en, p_ro);
begin
  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return;
  end if;

  select
    coalesce(array_agg(r.uid) filter (where u.locale is distinct from 'en'), '{}'),
    coalesce(array_agg(r.uid) filter (where u.locale = 'en'), '{}')
  into ro_ids, en_ids
  from (select distinct x.uid from unnest(p_user_ids) as x(uid) where x.uid is not null) r
  left join public.users u on u.id = r.uid
  where public.wants_notification(r.uid, p_type);

  if cardinality(ro_ids) > 0 then
    perform public.send_expo_push(ro_ids, p_ro ->> 'title', p_ro ->> 'body', payload);
  end if;
  if cardinality(en_ids) > 0 then
    perform public.send_expo_push(en_ids, en_copy ->> 'title', en_copy ->> 'body', payload);
  end if;
end;
$$;

revoke all on function public.send_notification(uuid[], text, jsonb, jsonb, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Push tokens: one per install, prune stale ones
-- ---------------------------------------------------------------------------
alter table public.push_tokens add column if not exists device_id text;

create index if not exists push_tokens_device_id_idx
  on public.push_tokens (device_id)
  where device_id is not null;

-- Replaces the 2-arg version (a 3-arg overload with a default would make
-- 2-arg calls ambiguous). Old app builds still call it with 2 named args.
drop function if exists public.register_push_token(text, text);

create or replace function public.register_push_token(
  p_token text,
  p_platform text,
  p_device_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- A new token from the same install replaces the old one.
  if p_device_id is not null then
    delete from public.push_tokens
    where device_id = p_device_id and token <> p_token;
  end if;

  insert into public.push_tokens (token, user_id, platform, device_id, updated_at)
  values (p_token, auth.uid(), p_platform, p_device_id, now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        device_id = coalesce(excluded.device_id, public.push_tokens.device_id),
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

-- The app re-registers on every launch (updated_at = now()), so a token this
-- old belongs to an install that's gone or unused for two months.
create or replace function public.prune_stale_push_tokens()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where updated_at < now() - interval '60 days';
$$;

revoke all on function public.prune_stale_push_tokens() from public, anon, authenticated;

create extension if not exists pg_cron with schema extensions;

select cron.unschedule('prune-push-tokens')
where exists (select 1 from cron.job where jobname = 'prune-push-tokens');

select cron.schedule(
  'prune-push-tokens',
  '30 3 * * *',
  $$ select public.prune_stale_push_tokens(); $$
);

-- ---------------------------------------------------------------------------
-- 4. Senders
-- ---------------------------------------------------------------------------

-- RSVP -> every organizer (latest: 20261002000002_event_co_organizers.sql)
create or replace function public.notify_organizer_on_rsvp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  answered_name text;
  ro_label text;
  en_label text;
begin
  if new.rsvp_status not in ('confirmed', 'declined') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.rsvp_status is not distinct from new.rsvp_status then
    return new;
  end if;

  select id, name into ev from public.events where id = new.event_id;
  if ev.id is null then
    return new;
  end if;

  select coalesce(nullif(trim(new.guest_name), ''), nullif(trim(u.display_name), ''))
    into answered_name
  from (select 1) one
  left join public.users u on u.id = new.guest_user_id;

  ro_label := coalesce(answered_name, 'Un invitat');
  en_label := coalesce(answered_name, 'A guest');

  perform public.send_notification(
    array_remove(public.event_organizer_ids(ev.id), new.guest_user_id),
    'rsvp_response',
    jsonb_build_object('url', '/event/' || ev.id),
    jsonb_build_object(
      'title', case when new.rsvp_status = 'confirmed'
        then ro_label || ' a confirmat' else ro_label || ' nu poate ajunge' end,
      'body', ev.name
    ),
    jsonb_build_object(
      'title', case when new.rsvp_status = 'confirmed'
        then en_label || ' is coming' else en_label || ' can''t make it' end,
      'body', ev.name
    )
  );
  return new;
end;
$$;

revoke all on function public.notify_organizer_on_rsvp() from public, anon, authenticated;

-- Day-before reminder (latest: 20261001000002_push_notifications.sql)
create or replace function public.send_event_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ev record;
  guest_ids uuid[];
  place text;
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
      place := nullif(trim(coalesce(ev.location, '')), '');
      perform public.send_notification(
        guest_ids,
        'event_reminder',
        jsonb_build_object('url', '/guest/' || ev.id),
        jsonb_build_object(
          'title', 'Mâine: ' || ev.name,
          'body', case when place is not null then 'Ne vedem mâine la ' || place || '.' else 'Ne vedem mâine!' end
        ),
        jsonb_build_object(
          'title', 'Tomorrow: ' || ev.name,
          'body', case when place is not null then 'See you tomorrow at ' || place || '.' else 'See you tomorrow!' end
        )
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.send_event_reminders() from public, anon, authenticated;

-- Menu choice reminder (latest: 20261001000005_menu_options.sql)
create or replace function public.send_menu_reminders()
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
    select e.id, e.name
    from public.events e
    left join public.menu m on m.event_id = e.id
    where e.event_date is not null
      and e.event_date - coalesce(m.choice_deadline_days, 2)
          = (now() at time zone 'Europe/Bucharest')::date + 1
      and exists (select 1 from public.menu_options o where o.event_id = e.id)
  loop
    select array_agg(guest_user_id) into guest_ids
    from public.event_guests
    where event_id = ev.id
      and rsvp_status = 'confirmed'
      and guest_user_id is not null
      and menu_option_id is null;

    if guest_ids is not null then
      perform public.send_notification(
        guest_ids,
        'menu_reminder',
        jsonb_build_object('url', '/detalii-menu/' || ev.id),
        jsonb_build_object('title', 'Alege meniul: ' || ev.name, 'body', 'Mai poți alege meniul până mâine.'),
        jsonb_build_object('title', 'Choose your menu: ' || ev.name, 'body', 'You can choose your menu until tomorrow.')
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.send_menu_reminders() from public, anon, authenticated;

-- Date / location changed (latest: 20261001000003_more_push_notifications.sql)
create or replace function public.notify_guests_on_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  date_changed boolean := old.event_date is distinct from new.event_date;
  place_changed boolean := coalesce(trim(old.location), '') is distinct from coalesce(trim(new.location), '');
  new_place text := nullif(trim(coalesce(new.location, '')), '');
  ro_body text;
  en_body text;
begin
  if not date_changed and not place_changed then
    return new;
  end if;

  if date_changed and place_changed then
    ro_body := 'Data și locația s-au schimbat. Vezi detaliile.';
    en_body := 'The date and location changed. See the details.';
  elsif date_changed then
    if new.event_date is null then
      ro_body := 'Data va fi anunțată.';
      en_body := 'The date will be announced.';
    else
      ro_body := 'Noua dată: ' || to_char(new.event_date, 'DD.MM.YYYY');
      en_body := 'New date: ' || to_char(new.event_date, 'DD.MM.YYYY');
    end if;
  else
    if new_place is null then
      ro_body := 'Locația va fi anunțată.';
      en_body := 'The location will be announced.';
    else
      ro_body := 'Noua locație: ' || new_place;
      en_body := 'New location: ' || new_place;
    end if;
  end if;

  perform public.send_notification(
    public.confirmed_guest_ids(new.id),
    'event_changed',
    jsonb_build_object('url', '/guest/' || new.id || '/detalii'),
    jsonb_build_object(
      'title', new.name || ': ' || case
        when date_changed and place_changed then 's-au schimbat detaliile'
        when date_changed then 's-a schimbat data'
        else 's-a schimbat locația'
      end,
      'body', ro_body
    ),
    jsonb_build_object(
      'title', new.name || ': ' || case
        when date_changed and place_changed then 'details changed'
        when date_changed then 'date changed'
        else 'location changed'
      end,
      'body', en_body
    )
  );
  return new;
end;
$$;

revoke all on function public.notify_guests_on_event_change() from public, anon, authenticated;

-- Venue set or changed (latest: 20261001000003_more_push_notifications.sql)
create or replace function public.notify_guests_on_venue_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_name text;
  place text := nullif(concat_ws(', ', nullif(trim(new.name), ''), nullif(trim(new.address), '')), '');
begin
  if tg_op = 'UPDATE'
     and coalesce(trim(old.name), '') = coalesce(trim(new.name), '')
     and coalesce(trim(old.address), '') = coalesce(trim(new.address), '') then
    return new;
  end if;
  if place is null then
    return new;
  end if;

  select name into ev_name from public.events where id = new.event_id;

  perform public.send_notification(
    public.confirmed_guest_ids(new.event_id),
    'event_changed',
    jsonb_build_object('url', '/guest/' || new.event_id || '/detalii'),
    jsonb_build_object(
      'title', ev_name || ': ' || case when tg_op = 'INSERT' then 's-a stabilit locația' else 's-a schimbat locația' end,
      'body', place
    ),
    jsonb_build_object(
      'title', ev_name || ': ' || case when tg_op = 'INSERT' then 'location set' else 'location changed' end,
      'body', place
    )
  );
  return new;
end;
$$;

revoke all on function public.notify_guests_on_venue_change() from public, anon, authenticated;

-- Album ready (latest: 20261002000002_event_co_organizers.sql)
create or replace function public.notify_on_album_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.album_status <> 'ready' or old.album_status = 'ready' then
    return new;
  end if;

  perform public.send_notification(
    public.confirmed_guest_ids(new.id) || public.event_organizer_ids(new.id),
    'album_ready',
    jsonb_build_object('url', '/guest/' || new.id || '/album'),
    jsonb_build_object(
      'title', 'Pozele de la ' || new.name || ' sunt gata 📸',
      'body', 'Toate fotografiile evenimentului, într-un singur album.'
    ),
    jsonb_build_object(
      'title', 'Photos from ' || new.name || ' are ready 📸',
      'body', 'All the event photos, in one album.'
    )
  );
  return new;
end;
$$;

revoke all on function public.notify_on_album_ready() from public, anon, authenticated;

-- New moment (latest: 20261001000003_more_push_notifications.sql)
create or replace function public.notify_guests_on_moment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_name text;
  moment_title text := nullif(trim(coalesce(new.title, '')), '');
begin
  select name into ev_name from public.events where id = new.event_id;

  perform public.send_notification(
    public.confirmed_guest_ids(new.event_id),
    'new_moment',
    jsonb_build_object('url', '/guest/' || new.event_id),
    jsonb_build_object('title', ev_name, 'body', coalesce(moment_title, 'Un moment nou a fost postat')),
    jsonb_build_object('title', ev_name, 'body', coalesce(moment_title, 'A new moment was posted'))
  );
  return new;
end;
$$;

revoke all on function public.notify_guests_on_moment() from public, anon, authenticated;

-- Event deleted (latest: 20261002000002_event_co_organizers.sql). Locked type.
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

  select coalesce(array_agg(distinct uid), '{}')
    into recipients
  from (
    select guest_user_id as uid
    from public.event_guests
    where event_id = old.id
      and guest_user_id is not null
      and rsvp_status <> 'declined'
    union
    select user_id
    from public.event_members
    where event_id = old.id
      and user_id is not null
  ) r
  where uid is distinct from old.organizer_id;

  perform public.send_notification(
    recipients,
    'event_cancelled',
    jsonb_build_object('url', '/'),
    jsonb_build_object(
      'title', 'Anulat: ' || old.name,
      'body', 'Organizatorul a anulat evenimentul. Invitația nu mai este valabilă.'
    ),
    jsonb_build_object(
      'title', 'Cancelled: ' || old.name,
      'body', 'The organizer cancelled the event. The invitation is no longer valid.'
    )
  );
  return old;
end;
$$;

revoke all on function public.notify_guests_on_event_delete() from public, anon, authenticated;
