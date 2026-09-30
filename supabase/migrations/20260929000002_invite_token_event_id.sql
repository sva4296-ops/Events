-- PovesteaNoastra — get_invite_by_token also returns the event id, so the web
-- RSVP page (povestea-web, /i/[token]) can link a guest who just confirmed
-- into the full event pages (/event/<eventId>) after they log in. Exposing the
-- id adds no access by itself: reading the event still goes through the
-- normal events/event_guests RLS for a signed-in guest.
--
-- The return type changes, so the function has to be dropped first
-- (CREATE OR REPLACE can't change a function's OUT columns).

drop function if exists public.get_invite_by_token(text);

create function public.get_invite_by_token(p_token text)
returns table (
  event_id uuid,
  event_name text,
  event_type public.event_type,
  event_date date,
  location text,
  welcome_message text,
  host_name text,
  guest_name text,
  rsvp_status public.rsvp_status
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.name,
    e.type,
    e.event_date,
    e.location,
    e.welcome_message,
    u.display_name,
    g.guest_name,
    g.rsvp_status
  from public.event_guests g
  join public.events e on e.id = g.event_id
  left join public.users u on u.id = e.organizer_id
  where g.invite_token = p_token
  limit 1;
$$;

revoke all on function public.get_invite_by_token(text) from public;
grant execute on function public.get_invite_by_token(text) to anon, authenticated;
