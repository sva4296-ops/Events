-- PovesteaNoastra — backfill public.users.phone for accounts created before
-- 20260818000001_phone_auth.sql added the column. handle_new_user() only
-- populates it on new auth.users inserts, so any account that signed up
-- earlier has phone = null in public.users even though auth.users.phone is
-- set, which made link_guest_on_invite()'s phone match (20260818000002) find
-- zero rows for those accounts. Mirrors 20260810000004_backfill_guest_links.sql's
-- shape, one column later. Idempotent, safe to run more than once.

update public.users u
set phone = a.phone
from auth.users a
where u.id = a.id
  and u.phone is null
  and a.phone is not null;

-- Re-link event_guests rows whose insert-time trigger missed the match
-- above because public.users.phone was still null at insert time.
update public.event_guests eg
set guest_user_id = u.id
from public.users u
where eg.guest_user_id is null
  and eg.guest_phone is not null
  and eg.guest_phone = u.phone;
