-- PovesteaNoastra — guest auto-link.
-- Links a pending event_guests invite (added by guest_email, guest_user_id null)
-- to a real account, in both directions:
--   1. the invite is created after the invitee's account already exists
--   2. the invitee signs up after the invite already exists
-- This was referenced by an earlier prompt as already built ("the v4 auto-link
-- trigger") — it wasn't; this migration is what actually adds it.

-- ---------------------------------------------------------------------------
-- Direction 1: a new event_guests row lands with an email that already has an
-- account. Runs before insert so it's a single write, not insert-then-update.
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
  return new;
end;
$$;

drop trigger if exists on_event_guest_insert on public.event_guests;
create trigger on_event_guest_insert
  before insert on public.event_guests
  for each row execute function public.link_guest_on_invite();

-- ---------------------------------------------------------------------------
-- Direction 2: a new account signs up matching an existing pending invite.
-- Fires on public.users (not auth.users) so it stays decoupled from
-- handle_new_user() — that trigger already populates public.users first.
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
    and guest_email is not null
    and lower(guest_email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists on_user_created_link_invites on public.users;
create trigger on_user_created_link_invites
  after insert on public.users
  for each row execute function public.link_invites_on_signup();

-- ---------------------------------------------------------------------------
-- One invite per email per event. Nothing enforced this before — a client bug
-- could otherwise insert duplicates.
-- ---------------------------------------------------------------------------
create unique index if not exists event_guests_unique_email
  on public.event_guests (event_id, lower(guest_email))
  where guest_email is not null;
