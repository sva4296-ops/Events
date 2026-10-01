-- Three more pushes, all low-frequency, on top of
-- 20261001000002_push_notifications.sql (same send_expo_push sender):
--
--   1. Date or location changed (events.event_date / events.location, or the
--      venue's name/address)          -> confirmed guests
--   2. Album ready (album_status flips to 'ready', ~72h after the event)
--                                      -> confirmed guests + organizer
--   3. New moment posted by the organizer -> confirmed guests
--
-- Recipients are confirmed guests only: pending/declined guests shouldn't get
-- event-day noise. If nobody has confirmed yet (organizer still setting the
-- event up), these send nothing.

-- Internal helper: confirmed guests that have an account.
create or replace function public.confirmed_guest_ids(p_event_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(guest_user_id), '{}')
  from public.event_guests
  where event_id = p_event_id and rsvp_status = 'confirmed' and guest_user_id is not null;
$$;

revoke all on function public.confirmed_guest_ids(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1a. Event date / location changed (events row)
-- ---------------------------------------------------------------------------
create or replace function public.notify_guests_on_event_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  date_changed boolean := old.event_date is distinct from new.event_date;
  place_changed boolean := coalesce(trim(old.location), '') is distinct from coalesce(trim(new.location), '');
  body text;
begin
  if not date_changed and not place_changed then
    return new;
  end if;

  body := case
    when date_changed and place_changed then 'Data și locația s-au schimbat. Vezi detaliile.'
    when date_changed then
      case when new.event_date is null then 'Data va fi anunțată.'
           else 'Noua dată: ' || to_char(new.event_date, 'DD.MM.YYYY') end
    else
      case when coalesce(trim(new.location), '') = '' then 'Locația va fi anunțată.'
           else 'Noua locație: ' || trim(new.location) end
  end;

  perform public.send_expo_push(
    public.confirmed_guest_ids(new.id),
    new.name || ': ' || case
      when date_changed and place_changed then 's-au schimbat detaliile'
      when date_changed then 's-a schimbat data'
      else 's-a schimbat locația'
    end,
    body,
    jsonb_build_object('url', '/guest/' || new.id || '/detalii')
  );
  return new;
end;
$$;

revoke all on function public.notify_guests_on_event_change() from public, anon, authenticated;

drop trigger if exists on_event_change_notify on public.events;
create trigger on_event_change_notify
  after update of event_date, location on public.events
  for each row execute function public.notify_guests_on_event_change();

-- ---------------------------------------------------------------------------
-- 1b. Venue set or changed (venue_info row; saved via upsert, so the first
--     save fires INSERT and later edits fire UPDATE). Notes and map
--     coordinates alone don't notify.
-- ---------------------------------------------------------------------------
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

  perform public.send_expo_push(
    public.confirmed_guest_ids(new.event_id),
    ev_name || ': ' || case when tg_op = 'INSERT' then 's-a stabilit locația' else 's-a schimbat locația' end,
    place,
    jsonb_build_object('url', '/guest/' || new.event_id || '/detalii')
  );
  return new;
end;
$$;

revoke all on function public.notify_guests_on_venue_change() from public, anon, authenticated;

drop trigger if exists on_venue_change_notify on public.venue_info;
create trigger on_venue_change_notify
  after insert or update of name, address on public.venue_info
  for each row execute function public.notify_guests_on_venue_change();

-- ---------------------------------------------------------------------------
-- 2. Album ready (flipped by the advance_album_status() cron)
-- ---------------------------------------------------------------------------
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

  perform public.send_expo_push(
    public.confirmed_guest_ids(new.id) || new.organizer_id,
    'Pozele de la ' || new.name || ' sunt gata 📸',
    'Toate fotografiile evenimentului, într-un singur album.',
    jsonb_build_object('url', '/guest/' || new.id || '/album')
  );
  return new;
end;
$$;

revoke all on function public.notify_on_album_ready() from public, anon, authenticated;

drop trigger if exists on_album_ready_notify on public.events;
create trigger on_album_ready_notify
  after update of album_status on public.events
  for each row execute function public.notify_on_album_ready();

-- ---------------------------------------------------------------------------
-- 3. New moment from the organizer
-- ---------------------------------------------------------------------------
create or replace function public.notify_guests_on_moment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ev_name text;
begin
  select name into ev_name from public.events where id = new.event_id;

  perform public.send_expo_push(
    public.confirmed_guest_ids(new.event_id),
    ev_name,
    coalesce(nullif(trim(new.title), ''), 'Un moment nou a fost postat'),
    jsonb_build_object('url', '/guest/' || new.event_id)
  );
  return new;
end;
$$;

revoke all on function public.notify_guests_on_moment() from public, anon, authenticated;

drop trigger if exists on_moment_notify on public.moments;
create trigger on_moment_notify
  after insert on public.moments
  for each row execute function public.notify_guests_on_moment();
