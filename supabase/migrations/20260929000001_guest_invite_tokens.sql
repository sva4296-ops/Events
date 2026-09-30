-- PovesteaNoastra — per-guest invite tokens for the web RSVP page
-- (povestea-web, /i/[token]). Lets a guest without the app open their
-- personal WhatsApp link in a browser and answer Confirm/Decline with no
-- login. The token is the only credential: it identifies exactly one
-- event_guests row, and the two functions below expose nothing beyond that
-- one row's own invite (event basics + that guest's own RSVP).
--
-- Trade-off, accepted on purpose: a forwarded link lets whoever holds it
-- answer for that guest. The organizer still sees and can fix every RSVP.

-- 32 hex chars (122 random bits via gen_random_uuid, built in, no extension
-- needed). Default covers every future insert path (single add, bulk RPC,
-- self-RSVP from the app) without touching any of them. Because the default
-- is volatile, Postgres evaluates it per existing row when the column is
-- added, so every existing guest gets its own distinct token too.
alter table public.event_guests
  add column if not exists invite_token text
    not null default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists event_guests_invite_token_key
  on public.event_guests (invite_token);

-- ---------------------------------------------------------------------------
-- get_invite_by_token — the web page's read path. Anonymous by design.
-- Returns zero rows for an unknown token.
-- ---------------------------------------------------------------------------
create or replace function public.get_invite_by_token(p_token text)
returns table (
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

-- ---------------------------------------------------------------------------
-- respond_to_invite_by_token — the web page's only write. Can only ever set
-- rsvp_status/responded_at on the single row the token names; returns the
-- new status, or null for an unknown token.
-- ---------------------------------------------------------------------------
create or replace function public.respond_to_invite_by_token(
  p_token text,
  p_status public.rsvp_status
)
returns public.rsvp_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.rsvp_status;
begin
  if p_status not in ('confirmed', 'declined') then
    raise exception 'invalid rsvp status: %', p_status;
  end if;

  update public.event_guests
  set rsvp_status = p_status,
      responded_at = now()
  where invite_token = p_token
  returning rsvp_status into v_status;

  return v_status;
end;
$$;

revoke all on function public.get_invite_by_token(text) from public;
revoke all on function public.respond_to_invite_by_token(text, public.rsvp_status) from public;
grant execute on function public.get_invite_by_token(text) to anon, authenticated;
grant execute on function public.respond_to_invite_by_token(text, public.rsvp_status) to anon, authenticated;
