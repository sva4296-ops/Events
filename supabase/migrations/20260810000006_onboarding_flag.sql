-- PovesteaNoastra — per-account onboarding tracking.
-- Backs the post-auth onboarding flow: show the 4-step tutorial once, after the
-- first successful sign-in, then never again for that account (any device).
-- No RLS policy change needed — the existing "users update own row" policy
-- (id = auth.uid()) already covers writing this column.

alter table public.users
  add column if not exists has_completed_onboarding boolean not null default false;