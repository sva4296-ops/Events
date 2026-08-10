-- PovesteaNoastra — Row Level Security.
-- Rule: organizers manage their own events end to end; guests read the events
-- they were invited to, control only their own RSVP, and may post to the shared
-- chat / photos / reactions of those events.

-- ---------------------------------------------------------------------------
-- Helpers. SECURITY DEFINER avoids the recursive policy evaluation you get from
-- inlining these lookups into the policies themselves.
-- ---------------------------------------------------------------------------
create or replace function public.is_event_organizer(target_event uuid)
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

create or replace function public.is_event_guest(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_guests g
    where g.event_id = target_event and g.guest_user_id = auth.uid()
  );
$$;

create or replace function public.can_view_event(target_event uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_event_organizer(target_event) or public.is_event_guest(target_event);
$$;

alter table public.users            enable row level security;
alter table public.events           enable row level security;
alter table public.event_guests     enable row level security;
alter table public.schedule_items   enable row level security;
alter table public.venue_info       enable row level security;
alter table public.moments          enable row level security;
alter table public.moment_reactions enable row level security;
alter table public.messages         enable row level security;
alter table public.fund             enable row level security;
alter table public.contributions    enable row level security;
alter table public.photos           enable row level security;

-- users ---------------------------------------------------------------------
create policy "users read own row" on public.users
  for select using (id = auth.uid());
create policy "users update own row" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- events --------------------------------------------------------------------
create policy "view events you organize or attend" on public.events
  for select using (organizer_id = auth.uid() or public.is_event_guest(id));
create policy "create your own events" on public.events
  for insert with check (organizer_id = auth.uid());
create policy "organizer updates own event" on public.events
  for update using (organizer_id = auth.uid()) with check (organizer_id = auth.uid());
create policy "organizer deletes own event" on public.events
  for delete using (organizer_id = auth.uid());

-- event_guests --------------------------------------------------------------
create policy "view guest list of visible events" on public.event_guests
  for select using (guest_user_id = auth.uid() or public.is_event_organizer(event_id));
create policy "organizer invites guests" on public.event_guests
  for insert with check (
    public.is_event_organizer(event_id)
    -- An organizer is never a guest of their own event.
    and (guest_user_id is null or guest_user_id <> auth.uid())
  );
create policy "guest claims own invite" on public.event_guests
  for insert with check (guest_user_id = auth.uid() and not public.is_event_organizer(event_id));
create policy "update own rsvp or as organizer" on public.event_guests
  for update using (guest_user_id = auth.uid() or public.is_event_organizer(event_id))
  with check (guest_user_id = auth.uid() or public.is_event_organizer(event_id));
create policy "organizer removes guests" on public.event_guests
  for delete using (public.is_event_organizer(event_id));

-- schedule_items / venue_info: everyone on the event reads, organizer writes --
create policy "view schedule" on public.schedule_items
  for select using (public.can_view_event(event_id));
create policy "organizer writes schedule" on public.schedule_items
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

create policy "view venue" on public.venue_info
  for select using (public.can_view_event(event_id));
create policy "organizer writes venue" on public.venue_info
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- moments: organizer posts, everyone on the event reads ----------------------
create policy "view moments" on public.moments
  for select using (public.can_view_event(event_id));
create policy "organizer writes moments" on public.moments
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id) and organizer_id = auth.uid());

-- moment_reactions: anyone on the event reacts, but only as themselves -------
create policy "view reactions" on public.moment_reactions
  for select using (
    exists (
      select 1 from public.moments m
      where m.id = moment_id and public.can_view_event(m.event_id)
    )
  );
create policy "react as yourself" on public.moment_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.moments m
      where m.id = moment_id and public.can_view_event(m.event_id)
    )
  );
create policy "remove own reaction" on public.moment_reactions
  for delete using (user_id = auth.uid());

-- messages: shared group chat for the event ---------------------------------
create policy "view messages" on public.messages
  for select using (public.can_view_event(event_id));
create policy "send messages as yourself" on public.messages
  for insert with check (sender_id = auth.uid() and public.can_view_event(event_id));
create policy "delete own message" on public.messages
  for delete using (sender_id = auth.uid() or public.is_event_organizer(event_id));

-- fund: organizer manages, everyone on the event sees ------------------------
create policy "view fund" on public.fund
  for select using (public.can_view_event(event_id));
create policy "organizer manages fund" on public.fund
  for all using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

-- contributions: visible to the event; writes land server-side after payment --
create policy "view contributions" on public.contributions
  for select using (
    exists (
      select 1 from public.fund f
      where f.id = fund_id and public.can_view_event(f.event_id)
    )
  );
-- No insert policy on purpose: contributions are written by the Stripe webhook
-- using the service role, never straight from the client.

-- photos: anyone on the event uploads, everyone on the event sees ------------
create policy "view photos" on public.photos
  for select using (public.can_view_event(event_id));
create policy "upload photos as yourself" on public.photos
  for insert with check (uploaded_by = auth.uid() and public.can_view_event(event_id));
create policy "delete own photo" on public.photos
  for delete using (uploaded_by = auth.uid() or public.is_event_organizer(event_id));

-- Realtime feeds used by Chat, Live and Acasă -------------------------------
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.photos;
alter publication supabase_realtime add table public.moments;
alter publication supabase_realtime add table public.moment_reactions;
