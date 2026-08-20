-- PovesteaNoastra — business/agency account creation moved from signup-time
-- metadata to an authenticated Profile action ("Add business account").
--
-- 20260813000001_agencies.sql deliberately left agencies with no insert
-- policy, since at the time the only way to create one was
-- handle_new_user() (security definer, fires before a session even exists
-- for email signup). That's no longer the only path: a signed-in user can
-- now add a business account for themselves from app/agency-signup.tsx,
-- which needs a real client-side insert. Scoped as narrowly as every other
-- "manage your own row" policy in this schema — a session can only ever
-- insert a row where owner_user_id is its own uid, and the table's existing
-- unique constraint on owner_user_id still caps this at one agency per
-- account.
create policy "user can create own agency" on public.agencies
  for insert with check (owner_user_id = auth.uid());
