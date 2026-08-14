-- PovesteaNoastra — agency accounts.
-- Adds a second account type: businesses that manage events on behalf of
-- clients, distinct from an individual organizing their own event. Review
-- before applying: supabase db push, or paste into the SQL editor.
--
-- Design note: email confirmation is ON for this project (see CLAUDE.md §2),
-- so supabase.auth.signUp() never yields a session — there is no auth.uid()
-- available to do a client-side insert into agencies at signup time. The
-- agency row is created the same way display_name already is: via
-- raw_user_meta_data read inside handle_new_user(), a security-definer
-- trigger that fires on auth.users insert (immediately, before confirmation),
-- not from application code. This is the same reasoning §3 already documents
-- for why guest-email lookups can't happen client-side.

-- ---------------------------------------------------------------------------
-- agencies — one per owner in this pass (no staff/multi-user agencies yet)
-- ---------------------------------------------------------------------------
create table if not exists public.agencies (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.users (id) on delete cascade,
  company_name text not null,
  cui text not null,
  registration_number text,
  address text,
  created_at timestamptz not null default now()
);

alter table public.agencies enable row level security;

create policy "agency owner reads own agency" on public.agencies
  for select using (owner_user_id = auth.uid());
create policy "agency owner updates own agency" on public.agencies
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
-- No insert policy on purpose: rows are only ever created by handle_new_user()
-- below (security definer, bypasses RLS), never inserted directly by a client
-- session — same shape as contributions having no client insert policy.

-- ---------------------------------------------------------------------------
-- events.agency_id — nullable tag, not a new access-control boundary
-- ---------------------------------------------------------------------------
-- organizer_id stays the source of truth for events RLS, unchanged. In this
-- pass an agency has exactly one user (its owner), and every event an agency
-- owner creates already has organizer_id = that same user's id, so the
-- existing "organizer updates/deletes own event" policies already cover
-- agency-created events end to end. agency_id is populated for dashboard
-- filtering only; it grants no access by itself. If agency staff accounts are
-- ever added, that's the point a real agency-membership policy is needed —
-- not assumed here.
alter table public.events
  add column if not exists agency_id uuid references public.agencies (id) on delete set null;

create index if not exists events_agency_idx on public.events (agency_id, created_at desc);

-- ---------------------------------------------------------------------------
-- handle_new_user() — extended to also create the agency row on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_type text := coalesce(new.raw_user_meta_data ->> 'account_type', 'individual');
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
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
-- Trigger itself (on_auth_user_created) is unchanged — already wired to this
-- function by 20260810000001_initial_schema.sql, `create or replace` above is
-- enough.
