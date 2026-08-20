-- PovesteaNoastra — fix event_guests.guest_phone rows written with a leading
-- `+` by the add-guest phone-invite form before this bug was fixed. The app
-- used toE164() (E.164, `+`-prefixed) to build the value it wrote to
-- guest_phone, but Supabase stores auth.users.phone/public.users.phone
-- without the `+` (confirmed against a real row: `40790586600`, not
-- `+40790586600`) — the auto-link trigger's exact-match comparison could
-- therefore never succeed for any phone invite created before this fix.
-- Strips the leading `+` from existing rows, then re-runs the same re-link
-- 20260819000001_backfill_users_phone.sql already does, since those rows'
-- insert-time trigger run missed the match while the format still disagreed.
-- Idempotent, safe to run more than once.

update public.event_guests
set guest_phone = ltrim(guest_phone, '+')
where guest_phone is not null
  and guest_phone like '+%';

update public.event_guests eg
set guest_user_id = u.id
from public.users u
where eg.guest_user_id is null
  and eg.guest_phone is not null
  and eg.guest_phone = u.phone;
