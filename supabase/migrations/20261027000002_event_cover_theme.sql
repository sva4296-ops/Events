-- Cover themes replace the AI gradient (20261027000001): the organizer picks
-- one of the app's 20 drawn themes (utils/coverThemes.ts) in the create
-- wizard; Complet/Premium can ask AI to pick it. Null = the static per-type
-- cover. Written by the organizer through the existing events update policy.
alter table public.events
  drop column if exists cover_colors,
  drop column if exists cover_for_name,
  add column if not exists cover_theme text
    check (cover_theme is null or cover_theme ~ '^[a-z]{2,20}$');
