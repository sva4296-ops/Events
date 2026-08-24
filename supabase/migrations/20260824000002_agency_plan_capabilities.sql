-- PovesteaNoastra — agency-only capability flags from the Agenție pricing
-- tier: branding, a centralized panel, and volume billing.
--
-- These three describe what an *agency account* can do, not what a single
-- event's plan unlocks — they don't belong on plan_features
-- (20260824000001), which is scoped per-event-plan (rsvp/photo album/guest
-- cap/etc., all things a specific event either has or doesn't). agencies
-- already models agency-account-level state (company_name, cui,
-- registration_number, address — see 20260813000001_agencies.sql), so these
-- three join that same row rather than living in a table shaped around
-- per-event capabilities.
--
-- Defaulted true, not gated behind a second signup step or a plan choice:
-- this app has exactly one agency tier today (Agenție), and becomeAgency()
-- (hooks/useAgency.tsx) is the only way an agencies row is ever created —
-- every agency account gets everything the Agenție tier includes the moment
-- it exists. If a lower/higher agency sub-tier is ever added, that's the
-- point these stop being unconditional defaults and start being set
-- explicitly per row.
--
-- "Volum multiplu" (the fourth Agenție bullet, managing many events at
-- once) has no column here — it's the defining trait of an agency account
-- already (see CLAUDE.md's "Agency accounts" section: one owner, any number
-- of agency-tagged events), not a togglable capability, so there's nothing
-- to store for it.

alter table public.agencies
  add column if not exists branding_enabled boolean not null default true,
  add column if not exists centralized_panel_enabled boolean not null default true,
  add column if not exists volume_billing_enabled boolean not null default true;
