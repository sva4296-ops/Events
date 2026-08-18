-- PovesteaNoastra — invite a guest by phone number.
-- Mirrors the guest_email invite shape (20260810000003_guest_autolink.sql)
-- with a parallel guest_phone column, extends both auto-link trigger
-- directions to also match on phone, and adds a narrow RPC so a not-yet-
-- linked phone invitee (or the future standalone Next.js invite-fallback
-- page, which has no access to useEvents/eventsRepository.ts at all) can
-- read their own single pending invitation without needing the broader
-- `events` SELECT policy to be loosened.

-- ---------------------------------------------------------------------------
-- Column + constraints
-- ---------------------------------------------------------------------------
alter table public.event_guests add column if not exists guest_phone text;

-- Every existing insert path already sets one of these three (insertGuestInvite
-- sets guest_email, respondToInviteRow's self-insert branch sets
-- guest_user_id) — safe against current data.
alter table public.event_guests
  add constraint event_guests_contact_check
  check (guest_email is not null or guest_phone is not null or guest_user_id is not null);

-- Mirrors event_guests_unique_email. Phone is always stored pre-normalized to
-- E.164 client-side (see utils/countryCodes.ts's toE164), so no lower() needed.
create unique index if not exists event_guests_unique_phone
  on public.event_guests (event_id, guest_phone)
  where guest_phone is not null;

-- ---------------------------------------------------------------------------
-- Direction 1: a new event_guests row lands with a phone that already has an
-- account. Extends link_guest_on_invite() (20260810000003) — email lookup
-- stays first and wins if both happen to match; phone is only tried if the
-- email lookup (or absence of an email) left guest_user_id unset.
-- ---------------------------------------------------------------------------
create or replace function public.link_guest_on_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.guest_user_id is null and new.guest_email is not null then
    select u.id into new.guest_user_id
    from public.users u
    where lower(u.email) = lower(new.guest_email)
    limit 1;
  end if;

  if new.guest_user_id is null and new.guest_phone is not null then
    select u.id into new.guest_user_id
    from public.users u
    where u.phone = new.guest_phone
    limit 1;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Direction 2: a new account signs up matching an existing pending invite,
-- now by phone as well as email. Extends link_invites_on_signup() (20260810000003).
-- ---------------------------------------------------------------------------
create or replace function public.link_invites_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_guests
  set guest_user_id = new.id
  where guest_user_id is null
    and (
      (guest_email is not null and lower(guest_email) = lower(new.email))
      or (guest_phone is not null and new.phone is not null and guest_phone = new.phone)
    );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_invite_preview — the read path for a not-yet-linked phone invitee.
-- Deliberately takes only the event id as a parameter: the phone it matches
-- against is read server-side from the caller's own public.users row via
-- auth.uid(), never from a client-supplied value, so a URL can't be used to
-- spoof "whose invite is this" — the caller can only ever see their own.
-- Returns zero rows if there's no matching pending (or already-linked)
-- event_guests row for this caller and event.
-- ---------------------------------------------------------------------------
create or replace function public.get_invite_preview(p_event_id uuid)
returns table (
  event_id uuid,
  name text,
  type public.event_type,
  event_date date,
  location text,
  welcome_message text,
  guest_id uuid,
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
    g.id,
    g.rsvp_status
  from public.events e
  join public.event_guests g on g.event_id = e.id
  where e.id = p_event_id
    and (
      g.guest_user_id = auth.uid()
      or (
        g.guest_phone is not null
        and g.guest_phone = (select u.phone from public.users u where u.id = auth.uid())
      )
    )
  limit 1;
$$;

-- Only makes sense called from a session that has already completed OTP
-- verification (or signed in some other way) — mirrors reset_test_data()'s
-- grant-narrowing pattern (20260810000005), just scoped to `authenticated`
-- instead of `service_role`.
revoke all on function public.get_invite_preview(uuid) from public;
grant execute on function public.get_invite_preview(uuid) to authenticated;
