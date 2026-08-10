-- PovesteaNoastra — one-time backfill for event_guests rows created before
-- 20260810000003_guest_autolink.sql's on_event_guest_insert trigger existed.
-- That trigger only runs on INSERT, so rows written earlier were never linked
-- even though a matching public.users row exists — this fixes those in place.
-- Idempotent: only touches rows still missing a link, safe to run more than once.

update public.event_guests eg
set guest_user_id = u.id
from public.users u
where eg.guest_user_id is null
  and eg.guest_email is not null
  and lower(eg.guest_email) = lower(u.email);
