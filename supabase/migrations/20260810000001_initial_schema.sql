-- PovesteaNoastra — consolidated initial schema.
-- Supersedes the earlier draft in data/schema.sql (now deleted).
-- Review before applying: supabase db push, or paste into the SQL editor.

-- ---------------------------------------------------------------------------
-- users — mirrors auth.users so app tables can carry real foreign keys
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create type public.event_type as enum (
  'wedding', 'baptism', 'birthday', 'cause', 'corporate', 'memorial', 'other'
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.users (id) on delete cascade,
  type public.event_type not null default 'other',
  name text not null,
  event_date date,
  location text,
  welcome_message text,
  created_at timestamptz not null default now()
);

create index if not exists events_organizer_idx on public.events (organizer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- event_guests
-- ---------------------------------------------------------------------------
create type public.rsvp_status as enum ('pending', 'confirmed', 'declined');

create table if not exists public.event_guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  guest_user_id uuid references public.users (id) on delete set null,
  guest_email text,
  guest_name text,
  rsvp_status public.rsvp_status not null default 'pending',
  invited_at timestamptz not null default now(),
  responded_at timestamptz
);

-- One row per signed-in guest per event; an organizer is never their own guest.
create unique index if not exists event_guests_unique_user
  on public.event_guests (event_id, guest_user_id)
  where guest_user_id is not null;
create index if not exists event_guests_event_idx on public.event_guests (event_id);
create index if not exists event_guests_user_idx on public.event_guests (guest_user_id);

-- ---------------------------------------------------------------------------
-- schedule_items + venue_info (Detalii tab)
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  time text not null,
  title text not null,
  location text,
  sort_order integer not null default 0
);

create index if not exists schedule_items_event_idx
  on public.schedule_items (event_id, sort_order);

-- Kept separate rather than folded into events: it is optional, arrives later
-- than the event itself, and has its own edit surface.
create table if not exists public.venue_info (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  name text,
  address text,
  notes text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- moments + reactions (Acasă tab)
-- ---------------------------------------------------------------------------
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  organizer_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists moments_event_idx on public.moments (event_id, created_at desc);

create type public.reaction_type as enum ('love', 'celebrate');

create table if not exists public.moment_reactions (
  id uuid primary key default gen_random_uuid(),
  moment_id uuid not null references public.moments (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  reaction_type public.reaction_type not null,
  unique (moment_id, user_id, reaction_type)
);

-- ---------------------------------------------------------------------------
-- messages (Chat tab)
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  sender_label text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_event_idx on public.messages (event_id, created_at);

-- ---------------------------------------------------------------------------
-- fund + contributions (Fond tab)
-- ---------------------------------------------------------------------------
create table if not exists public.fund (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  title text not null,
  description text,
  target_amount numeric(12, 2) not null check (target_amount > 0),
  current_amount numeric(12, 2) not null default 0,
  currency text not null default 'RON'
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.fund (id) on delete cascade,
  contributor_name text,
  amount numeric(12, 2) not null check (amount > 0),
  stripe_payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists contributions_fund_idx on public.contributions (fund_id, created_at desc);

-- ---------------------------------------------------------------------------
-- photos (Live + Album tabs)
-- ---------------------------------------------------------------------------
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  uploaded_by uuid not null references public.users (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);

create index if not exists photos_event_idx on public.photos (event_id, created_at desc);
