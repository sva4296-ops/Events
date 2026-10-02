-- Co-organizers (nași, the other half of the couple): each signs in with their
-- own phone number and the event shows up in their "My events".
--
-- Model:
--   - The owner stays implicit: events.organizer_id. No backfill row.
--   - event_members holds everyone else with organizer access. role is only
--     'co_organizer' today (a 'vendor' role for photographers comes later).
--   - Invite by phone, linked automatically when that phone signs in, the
--     same two directions as event_guests (20260818000002_guest_phone_invites.sql).
--
-- Rights (product decision, 2 Oct 2026):
--   - Co-organizers have full organizer rights: is_event_organizer() now
--     returns true for them, and almost every RLS policy (including Storage
--     event-photos) already goes through it.
--   - Owner only: deleting the event, choosing the plan, managing the fund,
--     adding/removing co-organizers.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid references public.users (id) on delete cascade,
  role text not null default 'co_organizer' check (role in ('co_organizer')),
  -- Digits only, no leading '+', same format as users.phone / event_guests.guest_phone.
  invited_phone text,
  -- Typed by the owner; public.users is only readable by its own row.
  invited_name text,
  created_at timestamptz not null default now(),
  constraint event_members_contact_check check (user_id is not null or invited_phone is not null)
);

create unique index if not exists event_members_unique_phone
  on public.event_members (event_id, invited_phone)
  where invited_phone is not null;

create unique index if not exists event_members_unique_user
  on public.event_members (event_id, user_id)
  where user_id is not null;

create index if not exists event_members_user_idx on public.event_members (user_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_event_owner(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = target_event and e.organizer_id = auth.uid()
  );
$$;

create or replace function public.is_event_co_organizer(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = target_event and m.user_id = auth.uid() and m.role = 'co_organizer'
  );
$$;

-- Same signature, so every existing policy and trigger that calls it
-- (event_guests, schedule, venue, moments, menu, seating, accommodations,
-- vendors, menu_options, photos, Storage, guard on menu choice) now covers
-- co-organizers too.
create or replace function public.is_event_organizer(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_event_owner(target_event) or public.is_event_co_organizer(target_event);
$$;

-- Owner + linked co-organizers, for push recipients.
create or replace function public.event_organizer_ids(p_event_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct x.uid), '{}')
  from (
    select e.organizer_id as uid from public.events e where e.id = p_event_id and e.organizer_id is not null
    union
    select m.user_id from public.event_members m where m.event_id = p_event_id and m.user_id is not null
  ) x;
$$;

revoke all on function public.event_organizer_ids(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS: event_members
-- ---------------------------------------------------------------------------
alter table public.event_members enable row level security;

drop policy if exists "organizers view members" on public.event_members;
create policy "organizers view members" on public.event_members
  for select using (user_id = auth.uid() or public.is_event_organizer(event_id));

drop policy if exists "owner manages members" on public.event_members;
create policy "owner manages members" on public.event_members
  for all using (public.is_event_owner(event_id))
  with check (public.is_event_owner(event_id));

-- ---------------------------------------------------------------------------
-- RLS: events
-- The select policy keeps the direct organizer_id check (not a helper call):
-- insert ... returning has to see the new row, which a stable helper reading
-- the table snapshot would not.
-- ---------------------------------------------------------------------------
drop policy if exists "view events you organize or attend" on public.events;
create policy "view events you organize or attend" on public.events
  for select using (
    organizer_id = auth.uid()
    or public.is_event_co_organizer(id)
    or public.is_event_guest(id)
  );

drop policy if exists "organizer updates own event" on public.events;
create policy "organizer updates own event" on public.events
  for update using (public.is_event_organizer(id))
  with check (public.is_event_organizer(id));

-- "organizer deletes own event" (organizer_id = auth.uid()) stays as is: owner only.

-- Co-organizers can edit details, but not the owner-only columns.
create or replace function public.guard_event_owner_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / cron (album_status) have no auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  if new.organizer_id is distinct from old.organizer_id then
    raise exception 'The event owner cannot be changed.' using errcode = '42501';
  end if;

  if auth.uid() is distinct from old.organizer_id
     and (
       new.plan_tier is distinct from old.plan_tier
       or new.plan_purchased_at is distinct from old.plan_purchased_at
       or new.agency_id is distinct from old.agency_id
     ) then
    raise exception 'Only the event owner can change the plan.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_event_owner_columns on public.events;
create trigger guard_event_owner_columns
  before update on public.events
  for each row execute function public.guard_event_owner_columns();

-- ---------------------------------------------------------------------------
-- RLS: fund is owner only (guests, co-organizers included, still read it
-- through "view fund" and contribute like any guest).
-- ---------------------------------------------------------------------------
drop policy if exists "organizer manages fund" on public.fund;
create policy "organizer manages fund" on public.fund
  for all using (public.is_event_owner(event_id))
  with check (public.is_event_owner(event_id));

-- ---------------------------------------------------------------------------
-- Auto-link by phone, both directions (mirrors event_guests).
-- ---------------------------------------------------------------------------
create or replace function public.link_member_on_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null and new.invited_phone is not null then
    select u.id into new.user_id
    from public.users u
    where u.phone = new.invited_phone
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists on_event_member_insert on public.event_members;
create trigger on_event_member_insert
  before insert on public.event_members
  for each row execute function public.link_member_on_invite();

create or replace function public.link_members_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone is not null then
    update public.event_members
    set user_id = new.id
    where user_id is null
      and invited_phone = new.phone;
  end if;
  return new;
end;
$$;

drop trigger if exists on_user_created_link_members on public.users;
create trigger on_user_created_link_members
  after insert on public.users
  for each row execute function public.link_members_on_signup();

-- The owner is never also a co-organizer of their own event.
create or replace function public.guard_member_not_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null
     and exists (select 1 from public.events e where e.id = new.event_id and e.organizer_id = new.user_id) then
    raise exception 'The event owner cannot be added as a co-organizer.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Named to sort after on_event_member_insert (triggers fire alphabetically),
-- so it sees the linked user_id.
drop trigger if exists on_event_member_owner_guard on public.event_members;
create trigger on_event_member_owner_guard
  before insert or update of user_id on public.event_members
  for each row execute function public.guard_member_not_owner();

-- ---------------------------------------------------------------------------
-- Push: RSVP goes to every organizer (was organizer_id only,
-- 20261001000002_push_notifications.sql). Same body otherwise; skips the
-- person who answered, in case a co-organizer is also on the guest list.
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

  select id, name into ev from public.events where id = new.event_id;
  if ev.id is null then
    return new;
  end if;

  select coalesce(nullif(trim(new.guest_name), ''), nullif(trim(u.display_name), ''), 'Un invitat')
    into guest_label
  from (select 1) one
  left join public.users u on u.id = new.guest_user_id;

  perform public.send_expo_push(
    array_remove(public.event_organizer_ids(ev.id), new.guest_user_id),
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

-- Album ready: co-organizers too (was confirmed guests + organizer_id,
-- 20261001000003_more_push_notifications.sql).
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
    public.confirmed_guest_ids(new.id) || public.event_organizer_ids(new.id),
    'Pozele de la ' || new.name || ' sunt gata 📸',
    'Toate fotografiile evenimentului, într-un singur album.',
    jsonb_build_object('url', '/guest/' || new.id || '/album')
  );
  return new;
end;
$$;

revoke all on function public.notify_on_album_ready() from public, anon, authenticated;

-- Event deleted: co-organizers get the cancellation too (was guests only,
-- 20261002000001_event_deleted_push.sql). BEFORE DELETE, so event_members is
-- still there. The owner who deleted it is skipped.
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
