-- Co-organizers attend too: they pick a menu and sit at a table, and both of those
-- live on event_guests. So every co-organizer gets a confirmed guest row, reusing
-- the one they may already have from before they became a co-organizer. Removing
-- a co-organizer leaves the row: they stay a guest. Venue nights have no such rows.

create or replace function public.sync_member_guest(p_event_id uuid, p_user_id uuid, p_phone text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := p_phone;
  v_name text := p_name;
begin
  if exists (select 1 from public.events e where e.id = p_event_id and e.type = 'venue') then
    return;
  end if;

  if p_user_id is not null then
    select coalesce(v_phone, u.phone), coalesce(v_name, u.display_name)
      into v_phone, v_name
    from public.users u where u.id = p_user_id;
  end if;

  update public.event_guests g
  set rsvp_status = 'confirmed',
      responded_at = coalesce(g.responded_at, now()),
      guest_user_id = coalesce(g.guest_user_id, p_user_id)
  where g.event_id = p_event_id
    and (g.guest_user_id = p_user_id or g.guest_phone = v_phone)
    and (g.rsvp_status <> 'confirmed' or g.guest_user_id is null);

  if exists (
    select 1 from public.event_guests g
    where g.event_id = p_event_id and (g.guest_user_id = p_user_id or g.guest_phone = v_phone)
  ) then
    return;
  end if;

  begin
    insert into public.event_guests (event_id, guest_user_id, guest_phone, guest_name, rsvp_status, responded_at)
    values (p_event_id, p_user_id, v_phone, v_name, 'confirmed', now());
  exception when raise_exception then
    -- The plan's guest cap or a spot limit: being a co-organizer must not fail
    -- over it. They just have no guest row until there's room.
    null;
  end;
end;
$$;

revoke all on function public.sync_member_guest(uuid, uuid, text, text) from public, anon, authenticated;

create or replace function public.on_member_sync_guest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'co_organizer' then
    perform public.sync_member_guest(new.event_id, new.user_id, new.invited_phone, new.invited_name);
  end if;
  return new;
end;
$$;

revoke all on function public.on_member_sync_guest() from public, anon, authenticated;

drop trigger if exists on_event_member_sync_guest on public.event_members;
create trigger on_event_member_sync_guest
  after insert or update of user_id, role on public.event_members
  for each row execute function public.on_member_sync_guest();

-- Existing co-organizers, without an "X confirmed" push to the organizer for each.
alter table public.event_guests disable trigger on_event_guest_rsvp_notify;

select public.sync_member_guest(m.event_id, m.user_id, m.invited_phone, m.invited_name)
from public.event_members m
where m.role = 'co_organizer';

alter table public.event_guests enable trigger on_event_guest_rsvp_notify;
