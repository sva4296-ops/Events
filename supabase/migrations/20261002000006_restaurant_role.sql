-- Restaurant role (event_members.role = 'restaurant').
--
-- Invited by the owner by phone, like a co-organizer (same auto-link), but
-- NOT an organizer: is_event_co_organizer()/is_event_organizer() stay
-- 'co_organizer' only, so the restaurant gets none of the organizer policies.
-- Instead it gets targeted access:
--   - edits: venue (Locație), menu + menu_options (Meniul serii), seating
--     tables: name, shape, seats, position (Așezarea la mese). Who sits where
--     stays with the couple; each guest picks their own menu.
--   - reads: the event row and its guest list (who sits where, portions)
--   - nothing else: no chat, fund, moments, photos, schedule, accommodation,
--     vendors; can't edit or delete the event (events update/delete stay
--     organizer/owner only).

-- ---------------------------------------------------------------------------
-- Role value
-- ---------------------------------------------------------------------------
alter table public.event_members drop constraint if exists event_members_role_check;
alter table public.event_members
  add constraint event_members_role_check check (role in ('co_organizer', 'restaurant'));

create or replace function public.is_event_restaurant(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = target_event and m.user_id = auth.uid() and m.role = 'restaurant'
  );
$$;

-- Push recipients: organizers only (was every linked member,
-- 20261002000002_event_co_organizers.sql). The restaurant doesn't get RSVP
-- or album pushes.
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
    select m.user_id from public.event_members m
    where m.event_id = p_event_id and m.user_id is not null and m.role = 'co_organizer'
  ) x;
$$;

revoke all on function public.event_organizer_ids(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reads
-- ---------------------------------------------------------------------------
drop policy if exists "view events you organize or attend" on public.events;
create policy "view events you organize or attend" on public.events
  for select using (
    organizer_id = auth.uid()
    or public.is_event_co_organizer(id)
    or public.is_event_guest(id)
    or public.is_event_restaurant(id)
  );

drop policy if exists "restaurant views guests" on public.event_guests;
create policy "restaurant views guests" on public.event_guests
  for select using (public.is_event_restaurant(event_id));

-- ---------------------------------------------------------------------------
-- Writes: venue, menu, seating
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant manages venue" on public.venue_info;
create policy "restaurant manages venue" on public.venue_info
  for all using (public.is_event_restaurant(event_id))
  with check (public.is_event_restaurant(event_id));

drop policy if exists "restaurant manages menu" on public.menu;
create policy "restaurant manages menu" on public.menu
  for all using (public.is_event_restaurant(event_id))
  with check (public.is_event_restaurant(event_id));

drop policy if exists "restaurant manages menu options" on public.menu_options;
create policy "restaurant manages menu options" on public.menu_options
  for all using (public.is_event_restaurant(event_id))
  with check (public.is_event_restaurant(event_id));

drop policy if exists "restaurant manages seating" on public.seating_tables;
create policy "restaurant manages seating" on public.seating_tables
  for all using (public.is_event_restaurant(event_id))
  with check (public.is_event_restaurant(event_id));

-- Guests: no write access at all. The couple seats people and guests pick
-- their own menu; the restaurant builds the hall (tables) and the menu options.

-- A table that already has guests can't be deleted by the restaurant: they'd
-- silently lose their seat. It can delete empty tables.
create or replace function public.guard_restaurant_table_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and not public.is_event_organizer(old.event_id)
     and public.is_event_restaurant(old.event_id)
     and exists (select 1 from public.event_guests g where g.table_id = old.id) then
    raise exception 'This table has guests seated. Ask the couple to move them first.' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists guard_restaurant_table_delete on public.seating_tables;
create trigger guard_restaurant_table_delete
  before delete on public.seating_tables
  for each row execute function public.guard_restaurant_table_delete();

-- ---------------------------------------------------------------------------
-- Storage: menu course photos live under {eventId}/menu/...
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant reads menu photos" on storage.objects;
create policy "restaurant reads menu photos" on storage.objects
  for select using (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[2] = 'menu'
    and public.is_event_restaurant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "restaurant uploads menu photos" on storage.objects;
create policy "restaurant uploads menu photos" on storage.objects
  for insert with check (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[2] = 'menu'
    and public.is_event_restaurant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "restaurant deletes menu photos" on storage.objects;
create policy "restaurant deletes menu photos" on storage.objects
  for delete using (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[2] = 'menu'
    and public.is_event_restaurant((storage.foldername(name))[1]::uuid)
  );
