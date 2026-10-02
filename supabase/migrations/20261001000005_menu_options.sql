-- PovesteaNoastra: menu variants guests choose from, with a deadline.
--
-- * menu_options: whole menus (e.g. "Clasic", "Vegetarian", "Copii"), each
--   with its own starter/main/dessert. Organizer writes, everyone on the
--   event reads (same RLS shape as menu/seating_tables).
-- * menu.choice_deadline_days: how many days before event_date the choice
--   closes (organizer picks 1/2/3/7 in the app, default 2). The LAST day a
--   guest can change is event_date - choice_deadline_days, in Romanian time.
--   No event_date = never closes. The single-menu columns on `menu`
--   (starter/main/dessert) are legacy; this file copies them into one
--   option named "Meniu" and the app stops reading them.
-- * event_guests.menu_option_id: the guest's pick. Guests can already
--   update their own row ("update own rsvp or as organizer"); the deadline
--   is enforced here by guard_menu_choice(), not just in the UI. The
--   organizer can always change it (phone-only guests, late corrections).

-- ---------------------------------------------------------------------------
-- Tables / columns
-- ---------------------------------------------------------------------------
create table if not exists public.menu_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  starter text not null default '',
  main text not null default '',
  dessert text not null default '',
  sort_order integer not null default 0
);

create index if not exists menu_options_event_idx
  on public.menu_options (event_id, sort_order);

alter table public.menu_options enable row level security;

drop policy if exists "view menu options" on public.menu_options;
create policy "view menu options" on public.menu_options
  for select using (public.can_view_event(event_id));
drop policy if exists "organizer writes menu options" on public.menu_options;
create policy "organizer writes menu options" on public.menu_options
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

alter table public.menu
  add column if not exists choice_deadline_days integer not null default 2;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_choice_deadline_days_check') then
    alter table public.menu
      add constraint menu_choice_deadline_days_check check (choice_deadline_days between 0 and 30);
  end if;
end $$;

alter table public.event_guests
  add column if not exists menu_option_id uuid references public.menu_options (id) on delete set null,
  add column if not exists menu_chosen_at timestamptz;

create index if not exists event_guests_menu_option_idx
  on public.event_guests (menu_option_id) where menu_option_id is not null;

-- Existing single menus become the first option.
insert into public.menu_options (event_id, name, starter, main, dessert, sort_order)
select m.event_id, 'Meniu', coalesce(m.starter, ''), coalesce(m.main, ''), coalesce(m.dessert, ''), 0
from public.menu m
where coalesce(trim(m.starter), '') || coalesce(trim(m.main), '') || coalesce(trim(m.dessert), '') <> ''
  and not exists (select 1 from public.menu_options o where o.event_id = m.event_id);

-- ---------------------------------------------------------------------------
-- Deadline guard
-- ---------------------------------------------------------------------------
create or replace function public.menu_choice_closed(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select (now() at time zone 'Europe/Bucharest')::date > e.event_date - coalesce(m.choice_deadline_days, 2)
     from public.events e
     left join public.menu m on m.event_id = e.id
     where e.id = p_event_id and e.event_date is not null),
    false
  );
$$;

grant execute on function public.menu_choice_closed(uuid) to authenticated;

create or replace function public.guard_menu_choice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.menu_option_id is not distinct from old.menu_option_id then
    return new;
  end if;

  if new.menu_option_id is not null and not exists (
    select 1 from public.menu_options o
    where o.id = new.menu_option_id and o.event_id = new.event_id
  ) then
    raise exception 'menu_option_wrong_event' using errcode = '22023';
  end if;

  -- Organizer (incl. the FK's own "set null" when they delete an option) and
  -- service-role/cron (no auth.uid()) are never blocked by the deadline.
  if auth.uid() is not null
     and not public.is_event_organizer(new.event_id)
     and public.menu_choice_closed(new.event_id) then
    raise exception 'menu_choice_closed' using errcode = 'P0001';
  end if;

  new.menu_chosen_at := case when new.menu_option_id is null then null else now() end;
  return new;
end;
$$;

drop trigger if exists guard_menu_choice_trigger on public.event_guests;
create trigger guard_menu_choice_trigger
  before update of menu_option_id on public.event_guests
  for each row execute function public.guard_menu_choice();

-- ---------------------------------------------------------------------------
-- Reminder: the day before the last day to choose, to confirmed guests who
-- haven't picked yet (only events that actually have options).
-- ---------------------------------------------------------------------------
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
      perform public.send_expo_push(
        guest_ids,
        'Alege meniul: ' || ev.name,
        'Mai poți alege meniul până mâine.',
        jsonb_build_object('url', '/detalii-menu/' || ev.id)
      );
    end if;
  end loop;
end;
$$;

revoke all on function public.send_menu_reminders() from public, anon, authenticated;

-- 07:05 UTC, right after send-event-reminders.
select cron.schedule(
  'send-menu-reminders',
  '5 7 * * *',
  $$ select public.send_menu_reminders(); $$
);
