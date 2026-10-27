-- Spontaneous events get a two-level choice in the wizard: the kind of
-- outing (party / outing / limited / trip) and the activity (karaoke,
-- bowling, mountain…). events.template stays "which tool the Plan tab
-- uses" and gains three profiles: 'trip' (a gear list, same mechanics as
-- 'bring'), 'outing' and 'limited' (no list tool, just poll + bill).
alter table public.events drop constraint if exists events_template_check;
alter table public.events
  add constraint events_template_check
    check (template is null or template in ('karaoke', 'party', 'tasting', 'trip', 'outing', 'limited')),
  add column if not exists outing text
    check (outing is null or outing in ('party', 'outing', 'limited', 'trip')),
  -- Free id from the app's list (utils/outings.ts), 'other' = "Altceva".
  add column if not exists activity text
    check (activity is null or activity ~ '^[a-z_]{2,24}$');
