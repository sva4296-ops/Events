-- PovesteaNoastra — two fixes found while investigating a phone-signup user
-- missing entirely from public.users.
--
-- 1) handle_new_user() regression: 20260818000001_phone_auth.sql's
--    `create or replace function` replaced the whole function body, silently
--    dropping the agency-row-creation block 20260813000001_agencies.sql had
--    added — CREATE OR REPLACE doesn't merge across migrations. Re-merging
--    both here so future signups (phone or agency) both work from one
--    canonical definition.
-- 2) Backfill: every auth.users row with no public.users counterpart gets one
--    now, built the same way handle_new_user() builds it. This can't be
--    narrowed to a single confirmed cause without live DB access (every
--    handle_new_user() version in this repo's history is already null-safe
--    for a missing email), so — same as 20260810000004's backfill — fix the
--    drift directly rather than guess further at its origin.
-- 3) Re-run the phone guest-link backfill (20260819000001/20260819000002)
--    once more after step 2: any event_guests row invited by phone before
--    its invitee had a public.users row would have missed the auto-link
--    trigger for that reason alone, independent of phone formatting.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');
begin
  insert into public.users (id, email, phone, display_name)
  values (
    new.id,
    new.email,
    new.phone,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      new.phone,
      'Guest'
    )
  )
  on conflict (id) do nothing;

  if v_account_type = 'agency' then
    insert into public.agencies (owner_user_id, company_name, cui, registration_number, address)
    values (
      new.id,
      new.raw_user_meta_data ->> 'company_name',
      new.raw_user_meta_data ->> 'cui',
      nullif(new.raw_user_meta_data ->> 'registration_number', ''),
      nullif(new.raw_user_meta_data ->> 'address', '')
    )
    on conflict (owner_user_id) do nothing;
  end if;

  return new;
end;
$$;

-- Backfill any auth.users row with no public.users row yet — covers the
-- specifically reported id (27050398-0583-4076-8def-6ae96abe3fe6) without
-- hardcoding it, plus any other orphaned row from the same class of bug.
insert into public.users (id, email, phone, display_name)
select
  a.id,
  a.email,
  a.phone,
  coalesce(
    a.raw_user_meta_data ->> 'display_name',
    nullif(split_part(coalesce(a.email, ''), '@', 1), ''),
    a.phone,
    'Guest'
  )
from auth.users a
where not exists (select 1 from public.users u where u.id = a.id)
on conflict (id) do nothing;

-- Re-link phone invites that missed the trigger while their invitee's
-- public.users row didn't exist yet.
update public.event_guests eg
set guest_user_id = u.id
from public.users u
where eg.guest_user_id is null
  and eg.guest_phone is not null
  and eg.guest_phone = u.phone;
