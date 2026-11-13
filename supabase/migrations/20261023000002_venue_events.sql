-- Venue events ("Local"), everything but the enum value
-- (20261023000001_venue_enum.sql).
--
-- Who: only business accounts (a row in agencies) create them; events.agency_id
-- (already set on create for agency owners) is the venue's identity across
-- events, events.host_name the name guests see ("Bar Microfon").
--
-- Booking: a booking IS an event_guests row (rsvp 'confirmed' = booked,
-- 'declined' = cancelled) with party_size / zone / time / booking_code, so the
-- guest list, chat, Live and album work unchanged. Two ways in:
--   - the venue's public link https://<site>/i/<events.public_token>, posted
--     on a status or sent to customers: resolve_venue_token() (anon, returns
--     only the event id) lets app/i/[token].tsx route it, then the signed-in
--     customer books with book_venue_event(), which creates their row.
--   - an existing guest row (e.g. invited by phone): same function, by event id.
-- Capacity: party sizes per zone can't exceed venue_zones.capacity
-- (checked inside book_venue_event, under a row lock on the zone).
--
-- Followers: venue_followers (per agency) = customers who agreed to get the
-- venue's invitations, from the booking tick box or the Follow button.
-- name/phone are snapshotted server-side (public.users is self-read only).
-- The venue owner reads them to send invitations on WhatsApp.
--
-- Venue events don't count against the plan's guest cap: bookings aren't a
-- curated guest list (enforce_guest_cap redefined below).

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists host_name text,
  add column if not exists price_info text,
  add column if not exists booking_times text[] not null default '{}',
  add column if not exists max_party_size integer not null default 8,
  add column if not exists public_token text not null default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists events_public_token_key on public.events (public_token);

alter table public.events drop constraint if exists events_max_party_size_check;
alter table public.events
  add constraint events_max_party_size_check check (max_party_size between 1 and 50);

create table if not exists public.venue_zones (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  -- "tables for 4-6", "bar seats"
  detail text not null default '',
  capacity integer not null check (capacity between 1 and 5000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists venue_zones_event_idx on public.venue_zones (event_id);

alter table public.event_guests
  add column if not exists party_size integer,
  add column if not exists zone_id uuid references public.venue_zones (id) on delete set null,
  add column if not exists booking_time text,
  add column if not exists booking_code text,
  add column if not exists checked_in_at timestamptz;

alter table public.event_guests drop constraint if exists event_guests_party_size_check;
alter table public.event_guests
  add constraint event_guests_party_size_check check (party_size is null or party_size between 1 and 50);

-- ---------------------------------------------------------------------------
-- Only business accounts create venue events
-- ---------------------------------------------------------------------------
create or replace function public.guard_venue_event_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'venue'
     and (tg_op = 'INSERT' or old.type is distinct from new.type)
     and not exists (select 1 from public.agencies a where a.owner_user_id = new.organizer_id) then
    raise exception 'venue_requires_business' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_venue_event_owner on public.events;
create trigger guard_venue_event_owner
  before insert or update of type on public.events
  for each row execute function public.guard_venue_event_owner();

-- ---------------------------------------------------------------------------
-- Guest cap: skip venue events (same body as 20260828000001 otherwise)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_guest_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  if exists (select 1 from public.events e where e.id = new.event_id and e.type = 'venue') then
    return new;
  end if;

  select max_guests into v_max from public.event_plan_capabilities(new.event_id);

  if v_max is null then
    return new;
  end if;

  select count(*) into v_count from public.event_guests where event_id = new.event_id;

  if v_count >= v_max then
    raise exception
      'Guest limit reached for this event''s current plan (max %). Upgrade the plan to add more guests.',
      v_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS: zones
-- ---------------------------------------------------------------------------
alter table public.venue_zones enable row level security;

drop policy if exists "view venue zones" on public.venue_zones;
create policy "view venue zones" on public.venue_zones
  for select using (public.can_view_event(event_id));

drop policy if exists "organizer manages venue zones" on public.venue_zones;
create policy "organizer manages venue zones" on public.venue_zones
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- ---------------------------------------------------------------------------
-- Followers
-- ---------------------------------------------------------------------------
create table if not exists public.venue_followers (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  -- 'booking' (tick box when booking) | 'follow' (Follow button)
  source text not null default 'follow' check (source in ('booking', 'follow')),
  name text,
  phone text,
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create or replace function public.snapshot_venue_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  select coalesce(nullif(trim(u.display_name), ''), u.phone), u.phone
    into new.name, new.phone
  from public.users u where u.id = auth.uid();
  return new;
end;
$$;

drop trigger if exists snapshot_venue_follower on public.venue_followers;
create trigger snapshot_venue_follower
  before insert on public.venue_followers
  for each row execute function public.snapshot_venue_follower();

alter table public.venue_followers enable row level security;

drop policy if exists "follower or venue owner reads" on public.venue_followers;
create policy "follower or venue owner reads" on public.venue_followers
  for select using (
    user_id = auth.uid()
    or exists (select 1 from public.agencies a where a.id = agency_id and a.owner_user_id = auth.uid())
  );

drop policy if exists "follow as yourself" on public.venue_followers;
create policy "follow as yourself" on public.venue_followers
  for insert with check (user_id = auth.uid());

drop policy if exists "unfollow yourself" on public.venue_followers;
create policy "unfollow yourself" on public.venue_followers
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Public link → event id (anon, so a signed-out tap can be routed to sign-in
-- and back). Returns nothing else about the event.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_venue_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.events where public_token = p_token and type = 'venue';
$$;

revoke all on function public.resolve_venue_token(text) from public;
grant execute on function public.resolve_venue_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Booking page data: the event, its zones with free spots, the night's
-- programme, the caller's own booking and whether they follow the venue.
-- Readable with the public token OR when the caller can already see the event.
-- ---------------------------------------------------------------------------
create or replace function public.get_venue_booking(p_event_id uuid, p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_result jsonb;
begin
  select * into v_event from public.events where id = p_event_id and type = 'venue';
  if v_event.id is null then
    return null;
  end if;
  if not (public.can_view_event(p_event_id) or (p_token is not null and v_event.public_token = p_token)) then
    return null;
  end if;

  select jsonb_build_object(
    'event_id', v_event.id,
    'agency_id', v_event.agency_id,
    'name', v_event.name,
    'host_name', v_event.host_name,
    'event_date', v_event.event_date,
    'start_time', v_event.start_time,
    'location', v_event.location,
    'welcome_message', v_event.welcome_message,
    'price_info', v_event.price_info,
    'booking_times', to_jsonb(v_event.booking_times),
    'max_party_size', v_event.max_party_size,
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id, 'name', z.name, 'detail', z.detail, 'capacity', z.capacity,
        'booked', coalesce((
          select sum(g.party_size) from public.event_guests g
          where g.zone_id = z.id and g.rsvp_status = 'confirmed'
        ), 0)
      ) order by z.sort_order, z.created_at)
      from public.venue_zones z where z.event_id = v_event.id
    ), '[]'::jsonb),
    'lineup', coalesce((
      select jsonb_agg(jsonb_build_object('time', s.time, 'title', s.title) order by s.sort_order, s.time)
      from public.schedule_items s where s.event_id = v_event.id
    ), '[]'::jsonb),
    'my_booking', (
      select jsonb_build_object(
        'guest_id', g.id, 'rsvp_status', g.rsvp_status, 'party_size', g.party_size,
        'zone_id', g.zone_id, 'booking_time', g.booking_time, 'booking_code', g.booking_code,
        'checked_in_at', g.checked_in_at
      )
      from public.event_guests g
      where g.event_id = v_event.id and g.guest_user_id = auth.uid()
      limit 1
    ),
    'following', exists (
      select 1 from public.venue_followers f
      where f.agency_id = v_event.agency_id and f.user_id = auth.uid()
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_venue_booking(uuid, text) from public, anon;
grant execute on function public.get_venue_booking(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Book (or change a booking). Creates or updates the caller's own
-- event_guests row; raises 'zone_full' / 'not_found' / 'invalid_booking'.
-- ---------------------------------------------------------------------------
create or replace function public.book_venue_event(
  p_event_id uuid,
  p_token text,
  p_party_size integer,
  p_zone_id uuid,
  p_time text,
  p_follow boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_zone public.venue_zones;
  v_booked integer;
  v_existing public.event_guests;
  v_name text;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_event from public.events where id = p_event_id and type = 'venue';
  if v_event.id is null
     or not (public.can_view_event(p_event_id) or (p_token is not null and v_event.public_token = p_token)) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.is_event_organizer(p_event_id) then
    raise exception 'organizer_cannot_book' using errcode = '42501';
  end if;
  if p_party_size is null or p_party_size < 1 or p_party_size > v_event.max_party_size then
    raise exception 'invalid_booking' using errcode = 'P0001';
  end if;
  if cardinality(v_event.booking_times) > 0 and not (p_time = any (v_event.booking_times)) then
    raise exception 'invalid_booking' using errcode = 'P0001';
  end if;

  -- Lock the zone so two bookings can't both take its last spots.
  select * into v_zone from public.venue_zones where id = p_zone_id and event_id = p_event_id for update;
  if v_zone.id is null then
    raise exception 'invalid_booking' using errcode = 'P0001';
  end if;

  select * into v_existing from public.event_guests
  where event_id = p_event_id and guest_user_id = auth.uid() limit 1;

  select coalesce(sum(party_size), 0) into v_booked
  from public.event_guests
  where zone_id = v_zone.id and rsvp_status = 'confirmed' and id is distinct from v_existing.id;

  if v_booked + p_party_size > v_zone.capacity then
    raise exception 'zone_full' using errcode = 'P0001';
  end if;

  select coalesce(nullif(trim(display_name), ''), phone, 'Client') into v_name
  from public.users where id = auth.uid();

  v_code := coalesce(
    v_existing.booking_code,
    upper(substr(md5(random()::text), 1, 3)) || '-' || lpad((floor(random() * 10000))::int::text, 4, '0')
  );

  if v_existing.id is null then
    insert into public.event_guests (
      event_id, guest_user_id, guest_name, rsvp_status, responded_at,
      party_size, zone_id, booking_time, booking_code
    ) values (
      p_event_id, auth.uid(), v_name, 'confirmed', now(),
      p_party_size, v_zone.id, p_time, v_code
    );
  else
    update public.event_guests
    set rsvp_status = 'confirmed', responded_at = now(), party_size = p_party_size,
        zone_id = v_zone.id, booking_time = p_time, booking_code = v_code,
        guest_name = coalesce(guest_name, v_name)
    where id = v_existing.id;
  end if;

  if p_follow and v_event.agency_id is not null then
    insert into public.venue_followers (agency_id, source)
    values (v_event.agency_id, 'booking')
    on conflict (agency_id, user_id) do nothing;
  end if;

  return v_code;
end;
$$;

revoke all on function public.book_venue_event(uuid, text, integer, uuid, text, boolean) from public, anon;
grant execute on function public.book_venue_event(uuid, text, integer, uuid, text, boolean) to authenticated;
