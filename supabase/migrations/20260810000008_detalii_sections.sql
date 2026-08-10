-- PovesteaNoastra — four new Detalii sections: menu, seating, accommodation,
-- vendors. Same shape as the existing schedule_items/venue_info pattern:
-- organizer manages (all), anyone who can view the event reads.

-- ---------------------------------------------------------------------------
-- menu — one record per event, like venue_info/fund
-- ---------------------------------------------------------------------------
create table if not exists public.menu (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  starter text,
  main text,
  dessert text
);

alter table public.menu enable row level security;

create policy "view menu" on public.menu
  for select using (public.can_view_event(event_id));
create policy "organizer writes menu" on public.menu
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- ---------------------------------------------------------------------------
-- event_guests.dietary_preferences — a guest's own preference, not per-menu.
-- No new policy needed: "update own rsvp or as organizer" already covers any
-- column on a guest's own row (guest_user_id = auth.uid()), including this one.
-- ---------------------------------------------------------------------------
alter table public.event_guests
  add column if not exists dietary_preferences text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- seating_tables
-- ---------------------------------------------------------------------------
create table if not exists public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  label text,
  seat_count integer not null default 0,
  sort_order integer not null default 0
);

create index if not exists seating_tables_event_idx
  on public.seating_tables (event_id, sort_order);

alter table public.seating_tables enable row level security;

create policy "view seating" on public.seating_tables
  for select using (public.can_view_event(event_id));
create policy "organizer writes seating" on public.seating_tables
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- ---------------------------------------------------------------------------
-- accommodations
-- ---------------------------------------------------------------------------
create table if not exists public.accommodations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  detail_line text,
  price_line text,
  sort_order integer not null default 0
);

create index if not exists accommodations_event_idx
  on public.accommodations (event_id, sort_order);

alter table public.accommodations enable row level security;

create policy "view accommodations" on public.accommodations
  for select using (public.can_view_event(event_id));
create policy "organizer writes accommodations" on public.accommodations
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- ---------------------------------------------------------------------------
-- vendors
-- ---------------------------------------------------------------------------
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  category text,
  handle text,
  external_url text,
  sort_order integer not null default 0
);

create index if not exists vendors_event_idx
  on public.vendors (event_id, sort_order);

alter table public.vendors enable row level security;

create policy "view vendors" on public.vendors
  for select using (public.can_view_event(event_id));
create policy "organizer writes vendors" on public.vendors
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));
