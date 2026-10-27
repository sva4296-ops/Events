-- AI cover for Complet/Premium/Agenție events: three gradient colors chosen
-- by the ai-write function (kind 'cover') from the event's title and type.
-- Written only by that function (service role) after it checks the plan;
-- the app never writes them. Null = not generated yet (or Esențial: the
-- static per-type cover is shown instead).
alter table public.events
  add column if not exists cover_colors text[]
    check (cover_colors is null or array_length(cover_colors, 1) = 3),
  -- The title the colors were generated for: renaming the event regenerates.
  add column if not exists cover_for_name text;
