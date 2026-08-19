-- PovesteaNoastra — collect a real first/last name once, after first
-- verification, for both email and phone sign-up.
--
-- public.users gains first_name/last_name alongside the existing
-- display_name. handle_new_user() is deliberately NOT changed here: its
-- current auto-fill (email local-part -> phone -> 'Guest') already only ever
-- runs once, at auth.users INSERT time — before the new name step exists in
-- the app's flow — so it already behaves exactly as "a fallback before the
-- user sets a real name," never overwriting anything set later. The app's
-- new name-collection screen is the only thing that ever writes
-- first_name/last_name/display_name after that point.
--
-- Two trigger extensions so a real name, once set, also fixes guest-list
-- display for anyone already invited by email/phone, without any client
-- code needing to join across the auth.uid()-only RLS wall on public.users:
--   1. link_guest_on_invite() (event_guests insert) — if the invite matches
--      an existing account that already has a display_name, use it as
--      guest_name (only when the organizer didn't type one).
--   2. A new AFTER UPDATE trigger on public.users — when display_name is set
--      (typically by the new name step, after the guest was already linked),
--      backfill any of that user's still-nameless event_guests rows.

alter table public.users add column if not exists first_name text;
alter table public.users add column if not exists last_name text;

create or replace function public.link_guest_on_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text;
begin
  if new.guest_user_id is null and new.guest_email is not null then
    select u.id, u.display_name into new.guest_user_id, v_display_name
    from public.users u
    where lower(u.email) = lower(new.guest_email)
    limit 1;
  end if;

  if new.guest_user_id is null and new.guest_phone is not null then
    select u.id, u.display_name into new.guest_user_id, v_display_name
    from public.users u
    where u.phone = new.guest_phone
    limit 1;
  end if;

  if new.guest_name is null and v_display_name is not null then
    new.guest_name := v_display_name;
  end if;

  return new;
end;
$$;

create or replace function public.backfill_guest_name_from_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.event_guests
  set guest_name = new.display_name
  where guest_user_id = new.id
    and guest_name is null;
  return new;
end;
$$;

drop trigger if exists on_user_display_name_set on public.users;
create trigger on_user_display_name_set
  after update on public.users
  for each row
  when (new.display_name is distinct from old.display_name and new.display_name is not null)
  execute function public.backfill_guest_name_from_user();
