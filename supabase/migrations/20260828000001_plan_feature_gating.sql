-- PovesteaNoastra — server-side plan-tier feature gating.
--
-- The RN client (hooks/usePlanGate.tsx) already hides/locks these same
-- features in the UI, but a client-only check is trivially bypassable
-- (a direct REST/RPC call, a modified build). This migration is the real
-- enforcement layer, mirrored 1:1 against plan_features' capability columns
-- (20260824000001_plan_features.sql) so the two can never drift: every
-- gated table's insert is blocked at the database level when the owning
-- event's plan doesn't include that capability, regardless of which client
-- code path (or lack of one) tried to write it.
--
-- Two things are deliberately NOT gated here, per product decision: the
-- seating chart (seating_tables) and bulk WhatsApp invites
-- (upsert_event_guests_batch) — neither has a corresponding plan_features
-- column, so every tier has equal access to both today. Gating either would
-- be inventing a limit not backed by the real plan definition.
--
-- plan_tier = null (no plan chosen yet) is treated as Esențial — the
-- cheapest real tier — not as fully unlocked. This matches the "Choose a
-- plan" upsell already on Home's event cards (components/PlanTierBadge.tsx):
-- an event without a chosen plan behaves like the entry tier until one is
-- picked, rather than getting every capability for free.

-- ---------------------------------------------------------------------------
-- event_plan_capabilities — resolves one event to its effective
-- plan_features row, defaulting a null plan_tier to 'esential'. Single
-- source every check below reads from, so none of them can drift from what
-- plan_features actually says a tier includes.
-- ---------------------------------------------------------------------------
create or replace function public.event_plan_capabilities(target_event uuid)
returns public.plan_features
language sql
stable
security definer
set search_path = public
as $$
  select pf.*
  from public.events e
  join public.plan_features pf on pf.plan_key = coalesce(e.plan_tier, 'esential')
  where e.id = target_event;
$$;

-- ---------------------------------------------------------------------------
-- Guest list cap (plan_features.max_guests). A BEFORE INSERT FOR EACH ROW
-- trigger (not an RLS check) so it counts correctly across every insert
-- path, including a single multi-row statement (upsert_event_guests_batch's
-- own INSERT ... SELECT ... FROM jsonb_array_elements) — trigger row
-- processing sees each prior row of the same statement via the per-row
-- command-counter increment, where an RLS `with check` expression
-- evaluated against a single fixed statement snapshot would not, and could
-- let a whole over-cap batch through. Applies uniformly to every path that
-- creates an event_guests row — organizer single-add, bulk import, and a
-- guest's own first-response self-insert (respondToInviteRow) alike — a
-- filled cap is a filled cap regardless of who's adding the row.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_guest_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max integer;
  v_count integer;
begin
  select max_guests into v_max from public.event_plan_capabilities(new.event_id);

  if v_max is null then
    return new;
  end if;

  select count(*) into v_count from public.event_guests where event_id = new.event_id;

  if v_count >= v_max then
    raise exception
      'Guest limit reached for this event''s current plan (max %). Upgrade the plan to add more guests.',
      v_max
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_guest_cap_trigger on public.event_guests;
create trigger enforce_guest_cap_trigger
  before insert on public.event_guests
  for each row execute function public.enforce_guest_cap();

-- ---------------------------------------------------------------------------
-- Capability-flag gates — one generic trigger function, parameterized per
-- table with the plan_features boolean column it should check (passed as
-- the trigger's own argument, never client input, so there's no dynamic-SQL
-- injection surface). Reused across every gated table below instead of one
-- near-identical function per capability.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_plan_capability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capabilities public.plan_features;
  v_allowed boolean;
begin
  select * into v_capabilities from public.event_plan_capabilities(new.event_id);
  v_allowed := coalesce((to_jsonb(v_capabilities) ->> tg_argv[0])::boolean, false);

  if not v_allowed then
    raise exception
      'This event''s current plan does not include this feature (%). Upgrade the plan to unlock it.',
      tg_argv[0]
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_chat_plan on public.messages;
create trigger enforce_chat_plan
  before insert on public.messages
  for each row execute function public.enforce_plan_capability('chat_enabled');

drop trigger if exists enforce_fund_plan on public.fund;
create trigger enforce_fund_plan
  before insert on public.fund
  for each row execute function public.enforce_plan_capability('contributions_enabled');

drop trigger if exists enforce_accommodation_plan on public.accommodations;
create trigger enforce_accommodation_plan
  before insert on public.accommodations
  for each row execute function public.enforce_plan_capability('lodging_transport_enabled');

drop trigger if exists enforce_vendor_plan on public.vendors;
create trigger enforce_vendor_plan
  before insert on public.vendors
  for each row execute function public.enforce_plan_capability('vendor_tagging_enabled');

-- Live screen (plan_features.live_screen_enabled) is deliberately NOT
-- enforced here — Live and Album share the same `photos` table and the same
-- addPhoto write path, and photo_album_enabled is baseline-true on every
-- tier. There is no distinct server-side write to gate for "Live only"
-- without also incorrectly blocking Album uploads. It's client-side-only
-- (hooks/usePlanGate.tsx + app/guest/[id]/live.tsx), by explicit product
-- decision — see the migration header above.
