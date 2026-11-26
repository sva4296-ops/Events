-- Spontaneous events: everything except the enum values
-- (20261022000001_spontaneous_enums.sql).
--
--   events: template (karaoke | party | tasting), start_time ('HH:MM'),
--     reply_by (date), spot_limit (people, guests' +1 included).
--   event_guests: plus_one, bill_sent_at (guest says "I sent my share"),
--     bill_confirmed_at (organizer ticks it off).
--   event_polls + event_poll_votes: one group vote per event ("What time do we meet?").
--   plan_items (+ votes, ratings): the template's tool. 'song' = karaoke
--     queue (anyone on the event can add, upvote), 'bring' = "who brings
--     what" (guests claim through claim_plan_item), 'wine' = tasting sheet
--     (everyone rates 1-5).
--   bill_splits: total ÷ people, how to pay. No money goes through the app;
--     it's only the tally.
--   get_event_attendees(): names + answer + payment status of everyone who
--     said yes or maybe. event_guests RLS only shows a guest their own row,
--     so "Who's coming" / "Who's paid" need this.
--
-- Access helpers are the existing ones: can_view_event() (organizer or any
-- invited guest), is_event_organizer() (owner + co-organizers).

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists template text,
  add column if not exists start_time text,
  add column if not exists reply_by date,
  add column if not exists spot_limit integer;

alter table public.events drop constraint if exists events_template_check;
alter table public.events
  add constraint events_template_check check (template is null or template in ('karaoke', 'party', 'tasting'));

alter table public.events drop constraint if exists events_start_time_check;
alter table public.events
  add constraint events_start_time_check check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

alter table public.events drop constraint if exists events_spot_limit_check;
alter table public.events
  add constraint events_spot_limit_check check (spot_limit is null or spot_limit between 1 and 1000);

alter table public.event_guests
  add column if not exists plus_one boolean not null default false,
  add column if not exists bill_sent_at timestamptz,
  add column if not exists bill_confirmed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Spot limit: a 'confirmed' answer (plus its +1) can't push the event over
-- events.spot_limit. Raises 'event_full', which the app shows as "No spots left".
-- ---------------------------------------------------------------------------
create or replace function public.guard_spot_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_taken integer;
begin
  if new.rsvp_status <> 'confirmed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.rsvp_status = 'confirmed' and old.plus_one >= new.plus_one then
    return new;
  end if;

  select spot_limit into v_limit from public.events where id = new.event_id;
  if v_limit is null then
    return new;
  end if;

  select coalesce(sum(1 + g.plus_one::int), 0) into v_taken
  from public.event_guests g
  where g.event_id = new.event_id and g.rsvp_status = 'confirmed' and g.id <> new.id;

  if v_taken + 1 + new.plus_one::int > v_limit then
    raise exception 'event_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_spot_limit on public.event_guests;
create trigger guard_spot_limit
  before insert or update of rsvp_status, plus_one on public.event_guests
  for each row execute function public.guard_spot_limit();

-- A guest may only touch bill_confirmed_at through the organizer. The
-- existing "update own rsvp" policy allows any column on their own row, so
-- this trigger keeps a guest from ticking their own payment off.
create or replace function public.guard_bill_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bill_confirmed_at is distinct from old.bill_confirmed_at
     and auth.uid() is not null
     and not public.is_event_organizer(new.event_id) then
    raise exception 'bill_confirm_organizer_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_bill_confirmation on public.event_guests;
create trigger guard_bill_confirmation
  before update of bill_confirmed_at on public.event_guests
  for each row execute function public.guard_bill_confirmation();

-- ---------------------------------------------------------------------------
-- Group vote
-- ---------------------------------------------------------------------------
create table if not exists public.event_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events (id) on delete cascade,
  question text not null,
  -- [{ "id": "<short id>", "label": "21:00" }, ...] in display order.
  options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint event_polls_options_array check (jsonb_typeof(options) = 'array')
);

create table if not exists public.event_poll_votes (
  poll_id uuid not null references public.event_polls (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  option_id text not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.event_polls enable row level security;
alter table public.event_poll_votes enable row level security;

drop policy if exists "view polls" on public.event_polls;
create policy "view polls" on public.event_polls
  for select using (public.can_view_event(event_id));

drop policy if exists "organizer manages polls" on public.event_polls;
create policy "organizer manages polls" on public.event_polls
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

drop policy if exists "view poll votes" on public.event_poll_votes;
create policy "view poll votes" on public.event_poll_votes
  for select using (
    exists (select 1 from public.event_polls p where p.id = poll_id and public.can_view_event(p.event_id))
  );

drop policy if exists "vote as yourself" on public.event_poll_votes;
create policy "vote as yourself" on public.event_poll_votes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.event_polls p where p.id = poll_id and public.can_view_event(p.event_id))
  );

drop policy if exists "change own vote" on public.event_poll_votes;
create policy "change own vote" on public.event_poll_votes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "remove own vote" on public.event_poll_votes;
create policy "remove own vote" on public.event_poll_votes
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Plan items (songs / who brings what / wines)
-- ---------------------------------------------------------------------------
create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('song', 'bring', 'wine')),
  title text not null,
  -- Artist for a song, style for a wine; unused for 'bring'.
  detail text,
  sort_order integer not null default 0,
  -- Set server-side (set_plan_item_author); public.users is self-read only.
  added_by uuid references public.users (id) on delete set null,
  added_by_label text,
  claimed_by uuid references public.users (id) on delete set null,
  claimed_by_label text,
  created_at timestamptz not null default now()
);

create index if not exists plan_items_event_idx on public.plan_items (event_id);

create table if not exists public.plan_item_votes (
  item_id uuid not null references public.plan_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  primary key (item_id, user_id)
);

create table if not exists public.plan_item_ratings (
  item_id uuid not null references public.plan_items (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  primary key (item_id, user_id)
);

create or replace function public.set_plan_item_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.added_by := auth.uid();
  select coalesce(nullif(trim(u.display_name), ''), 'Invitat') into new.added_by_label
  from public.users u where u.id = auth.uid();
  return new;
end;
$$;

drop trigger if exists set_plan_item_author on public.plan_items;
create trigger set_plan_item_author
  before insert on public.plan_items
  for each row execute function public.set_plan_item_author();

alter table public.plan_items enable row level security;
alter table public.plan_item_votes enable row level security;
alter table public.plan_item_ratings enable row level security;

drop policy if exists "view plan items" on public.plan_items;
create policy "view plan items" on public.plan_items
  for select using (public.can_view_event(event_id));

-- Organizers add anything; guests may suggest songs.
drop policy if exists "add plan items" on public.plan_items;
create policy "add plan items" on public.plan_items
  for insert with check (
    public.is_event_organizer(event_id)
    or (kind = 'song' and public.can_view_event(event_id))
  );

drop policy if exists "organizer edits plan items" on public.plan_items;
create policy "organizer edits plan items" on public.plan_items
  for update using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

drop policy if exists "remove plan items" on public.plan_items;
create policy "remove plan items" on public.plan_items
  for delete using (public.is_event_organizer(event_id) or added_by = auth.uid());

drop policy if exists "view plan votes" on public.plan_item_votes;
create policy "view plan votes" on public.plan_item_votes
  for select using (
    exists (select 1 from public.plan_items i where i.id = item_id and public.can_view_event(i.event_id))
  );

drop policy if exists "upvote as yourself" on public.plan_item_votes;
create policy "upvote as yourself" on public.plan_item_votes
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.plan_items i where i.id = item_id and public.can_view_event(i.event_id))
  );

drop policy if exists "remove own upvote" on public.plan_item_votes;
create policy "remove own upvote" on public.plan_item_votes
  for delete using (user_id = auth.uid());

drop policy if exists "view plan ratings" on public.plan_item_ratings;
create policy "view plan ratings" on public.plan_item_ratings
  for select using (
    exists (select 1 from public.plan_items i where i.id = item_id and public.can_view_event(i.event_id))
  );

drop policy if exists "rate as yourself" on public.plan_item_ratings;
create policy "rate as yourself" on public.plan_item_ratings
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.plan_items i where i.id = item_id and public.can_view_event(i.event_id))
  );

drop policy if exists "change own rating" on public.plan_item_ratings;
create policy "change own rating" on public.plan_item_ratings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- "I'll bring it" / release it. Claims an unclaimed 'bring' item for the
-- caller, or releases one the caller holds. Guests can't update plan_items
-- directly (organizer only), so this is the one way in.
create or replace function public.claim_plan_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.plan_items;
  v_label text;
begin
  select * into v_item from public.plan_items where id = p_item_id;
  if v_item.id is null or v_item.kind <> 'bring' or not public.can_view_event(v_item.event_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_item.claimed_by = auth.uid() then
    update public.plan_items set claimed_by = null, claimed_by_label = null where id = p_item_id;
    return;
  end if;
  if v_item.claimed_by is not null then
    raise exception 'already_claimed' using errcode = 'P0001';
  end if;

  select coalesce(nullif(trim(u.display_name), ''), 'Invitat') into v_label
  from public.users u where u.id = auth.uid();
  update public.plan_items set claimed_by = auth.uid(), claimed_by_label = v_label where id = p_item_id;
end;
$$;

revoke all on function public.claim_plan_item(uuid) from public, anon;
grant execute on function public.claim_plan_item(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Bill split
-- ---------------------------------------------------------------------------
create table if not exists public.bill_splits (
  event_id uuid primary key references public.events (id) on delete cascade,
  title text not null,
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  people_count integer not null check (people_count between 1 and 1000),
  payment_method text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.bill_splits enable row level security;

drop policy if exists "view bill split" on public.bill_splits;
create policy "view bill split" on public.bill_splits
  for select using (public.can_view_event(event_id));

drop policy if exists "organizer manages bill split" on public.bill_splits;
create policy "organizer manages bill split" on public.bill_splits
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- ---------------------------------------------------------------------------
-- Attendees: yes + maybe, for "Who's coming" and "Who's paid"
-- ---------------------------------------------------------------------------
create or replace function public.get_event_attendees(p_event_id uuid)
returns table (
  guest_id uuid,
  name text,
  rsvp_status public.rsvp_status,
  plus_one boolean,
  bill_sent_at timestamptz,
  bill_confirmed_at timestamptz,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.id,
    coalesce(nullif(trim(g.guest_name), ''), nullif(trim(u.display_name), ''), 'Invitat'),
    g.rsvp_status,
    g.plus_one,
    g.bill_sent_at,
    g.bill_confirmed_at,
    g.guest_user_id is not distinct from auth.uid()
  from public.event_guests g
  left join public.users u on u.id = g.guest_user_id
  where g.event_id = p_event_id
    and g.rsvp_status in ('confirmed', 'maybe')
    and public.can_view_event(p_event_id)
  order by g.responded_at nulls last, g.invited_at;
$$;

revoke all on function public.get_event_attendees(uuid) from public, anon;
grant execute on function public.get_event_attendees(uuid) to authenticated;
