-- PovesteaNoastra — first/last name is now collected directly on the Create
-- Account form (individual and agency, email and phone) instead of a
-- separate post-auth "what's your name?" step (that screen, app/name.tsx,
-- and AuthGate's redirect to it, are removed this pass — see
-- 20260820000001_user_names.sql for where first_name/last_name themselves
-- were added).
--
-- handle_new_user() is extended to read first_name/last_name from
-- raw_user_meta_data — the same options.data channel 20260813000001 already
-- uses for company_name/cui — and to derive display_name from them when
-- present, ahead of the existing email/phone-derived fallback. This is the
-- canonical handle_new_user() from 20260819000003, re-merged with this one
-- extra read so future migrations keep building on a single definition
-- rather than silently dropping a prior block (the exact regression
-- 20260819000003 itself fixed once already).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');
  v_first_name text := nullif(new.raw_user_meta_data ->> 'first_name', '');
  v_last_name text := nullif(new.raw_user_meta_data ->> 'last_name', '');
begin
  insert into public.users (id, email, phone, first_name, last_name, display_name)
  values (
    new.id,
    new.email,
    new.phone,
    v_first_name,
    v_last_name,
    coalesce(
      nullif(trim(both ' ' from concat_ws(' ', v_first_name, v_last_name)), ''),
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
