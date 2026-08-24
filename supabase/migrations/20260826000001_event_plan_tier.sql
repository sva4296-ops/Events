-- PovesteaNoastra — events.plan_tier: which plan_features row (if any) this
-- event has picked.
--
-- Per-event, not per-organizer or per-agency: the pricing screen is now
-- reached in the context of one specific event (right after creating it, or
-- via a badge on that event's own card on Home — see CLAUDE.md's "Pricing
-- screen" section) rather than as a standalone screen off Profile, so the
-- selection it records has to live on the event row itself.
--
-- plan_purchased_at is separate from created_at (already exists) and from
-- plan_tier's own presence — it's "when was a plan actually chosen," which
-- for an event created before this column existed, or one whose organizer
-- has never opened the pricing screen, is simply null alongside a null
-- plan_tier.
--
-- No RLS policy change needed — the existing "only the organizer updates or
-- deletes" policy on `events` (20260810000002_rls_policies.sql) already
-- covers any column, the same way it already covered agency_id and every
-- other column added to this table since.

alter table public.events
  add column if not exists plan_tier text,
  add column if not exists plan_purchased_at timestamptz;

alter table public.events
  add constraint events_plan_tier_known_value check (
    plan_tier is null or plan_tier in ('esential', 'complet', 'premium', 'agentie')
  );
