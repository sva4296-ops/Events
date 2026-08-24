-- PovesteaNoastra — plan_features: the pricing screen's data model.
--
-- New table, not an extension of anything that existed before — no pricing
-- screen, no RevenueCat integration, and no plan/pricing table existed in
-- this repo prior to this migration (checked; see CLAUDE.md). This table is
-- the single source of truth for every card's title, badge, button, and
-- unlocked capabilities — everything except the actual price, which the
-- client resolves separately from RevenueCat's getOfferings() at read time
-- via revenuecat_package_id (a real IAP price can't be stored in Postgres
-- and kept correct — App Store/Play pricing is the source of truth for that).
--
-- is_navigation_only rows (e.g. an "Agenție" tier that isn't a direct IAP
-- purchase, just a link into the agency-signup flow) have no
-- revenuecat_package_id at all — enforced by the check constraint below —
-- and instead carry their own plain-text price_text and a navigate_to route.
--
-- Rewritten in place (this file was never applied — no DB credentials from
-- this environment for any migration since 20260810000003, so editing it
-- directly rather than layering a correction on top is safe and correct,
-- same as every other "not yet applied, not yet confirmed" migration in this
-- repo). The original version of this file shipped a free-text `features
-- jsonb` bullet list per row, seeded with placeholder copy that was never
-- checked against the real pricing cards. That's gone: capability booleans
-- (+ one numeric, max_guests) replace it, one column per real toggle a card
-- can turn on, matching the actual four-tier feature grid exactly. A guessed
-- jsonb array could silently drift from what a plan really unlocks; a named
-- boolean column can't.

create table public.plan_features (
  id uuid primary key default gen_random_uuid(),
  -- Stable, human-readable identifier — never shown to a user, never
  -- translated. Distinct from display_name, which is.
  plan_key text not null unique,
  display_name text not null,
  is_highlighted boolean not null default false,
  badge_text text,
  button_label text not null,
  -- The RevenueCat package identifier this row maps to. Null for a
  -- navigation-only row (see the check constraint below) or for a
  -- misconfigured row the client should render without a price.
  revenuecat_package_id text,
  -- True for a card whose button navigates into an in-app flow instead of
  -- calling purchasePackage — e.g. "Agenție," which isn't a direct IAP.
  is_navigation_only boolean not null default false,
  -- Route string for an is_navigation_only card, e.g. '/agency-signup'.
  -- Read as a plain string by app/pricing.tsx's router.push — this project
  -- doesn't have Expo Router's typedRoutes experiment enabled (checked
  -- app.json), so an arbitrary string here is not a type-safety gap beyond
  -- what already exists on every other router.push call in the app.
  navigate_to text,
  -- Plain display text for an is_navigation_only card's price line (e.g.
  -- "de la 179 lei/eveniment") — not a real IAP price, so it's just app
  -- copy rather than anything RevenueCat resolves.
  price_text text,
  sort_order integer not null default 0,

  -- Capability flags — the pricing screen derives each card's bullet list
  -- from these at render time (see app/pricing.tsx), never from stored
  -- free-text. rsvp/progress-feed/photo-album are true on every real row
  -- today (they're the baseline every tier includes, not something a tier
  -- adds) — kept as real columns anyway rather than assumed always-true in
  -- code, so a future tier that genuinely lacks one doesn't need a schema
  -- change.
  rsvp_enabled boolean not null default true,
  progress_feed_enabled boolean not null default true,
  photo_album_enabled boolean not null default true,
  -- Null = unlimited. 50 for Esențial; every other current tier is null.
  max_guests integer,
  contributions_enabled boolean not null default false,
  live_screen_enabled boolean not null default false,
  chat_enabled boolean not null default false,
  lodging_transport_enabled boolean not null default false,
  vendor_tagging_enabled boolean not null default false,
  priority_support_enabled boolean not null default false,

  created_at timestamptz not null default now(),
  constraint plan_features_navigation_shape check (
    (is_navigation_only and revenuecat_package_id is null)
    or not is_navigation_only
  ),
  constraint plan_features_max_guests_positive check (max_guests is null or max_guests > 0)
);

alter table public.plan_features enable row level security;

-- Pricing is non-sensitive app configuration, not user data — readable by
-- anyone, signed in or not, same reasoning event-type metadata is a plain
-- constant in utils/eventTypes.ts rather than gated behind auth. No
-- insert/update/delete policy on purpose: rows are managed from the
-- Supabase dashboard/SQL, never from the client — same "no client insert
-- policy on purpose" precedent as `agencies` before its self-signup policy
-- and `contributions` (CLAUDE.md §3).
create policy "plan_features are publicly readable"
  on public.plan_features
  for select
  using (true);

-- Seed data — the four real tiers, exact feature grid:
--   Esențial (149 lei):  RSVP, progress feed, photo album, up to 50 guests
--   Complet  (299 lei):  + contributions, live screen/QR, chat, unlimited guests
--   Premium  (499 lei):  + lodging/transport, vendor tagging, priority support
--   Agenție  (from 179 lei/event, navigation-only): same capabilities as
--     Premium — its account-level extras (branding, a centralized panel,
--     volume billing) live on public.agencies instead, since they describe
--     what an agency *account* can do, not a single event's unlocked
--     features; see 20260824000002_agency_plan_capabilities.sql. "Volum
--     multiplu" (managing many events at once) isn't its own flag anywhere
--     — it's the defining trait of an agency account already, not a
--     togglable capability (see CLAUDE.md's "Agency accounts" section), so
--     app/pricing.tsx renders it as a fixed bullet on this one card rather
--     than reading it from a column.
-- This is config, not synthetic per-event data, so it doesn't fall under
-- CLAUDE.md §6's "no mock or seeded data" rule (that rule is about a new
-- event starting with fake guests/moments/contributions, not about a config
-- table needing at least one row to render anything at all). Adjust
-- revenuecat_package_id directly in the Supabase dashboard once real
-- RevenueCat Offering package identifiers exist — the values below are
-- placeholders.
insert into public.plan_features
  (plan_key, display_name, is_highlighted, badge_text, button_label, revenuecat_package_id,
   is_navigation_only, navigate_to, price_text, sort_order,
   rsvp_enabled, progress_feed_enabled, photo_album_enabled, max_guests,
   contributions_enabled, live_screen_enabled, chat_enabled,
   lodging_transport_enabled, vendor_tagging_enabled, priority_support_enabled)
values
  ('esential', 'Esențial', false, null, 'Alege', 'esential_monthly',
   false, null, null, 1,
   true, true, true, 50,
   false, false, false,
   false, false, false),
  ('complet', 'Complet', true, 'Cel mai ales', 'Alege', 'complet_monthly',
   false, null, null, 2,
   true, true, true, null,
   true, true, true,
   false, false, false),
  ('premium', 'Premium', false, null, 'Alege', 'premium_monthly',
   false, null, null, 3,
   true, true, true, null,
   true, true, true,
   true, true, true),
  ('agentie', 'Agenție', false, null, 'Vezi panoul', null,
   true, '/agency-signup', 'de la 179 lei/eveniment', 4,
   true, true, true, null,
   true, true, true,
   true, true, true);
