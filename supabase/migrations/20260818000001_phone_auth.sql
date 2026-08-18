-- PovesteaNoastra — phone OTP authentication.
-- Adds a phone column to public.users (mirrors auth.users.phone, same
-- denormalization reasoning already used for email) and updates
-- handle_new_user() so a phone-only signup (no email at all) still gets a
-- sensible display_name instead of null.

alter table public.users add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
  return new;
end;
$$;

-- No RLS change needed: "users read/update own row" already key off
-- auth.uid() alone, not email — checked every policy in
-- 20260810000002_rls_policies.sql, none reference the email column.
