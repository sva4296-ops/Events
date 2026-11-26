-- Optional line icon an organizer tags a moment with (shown next to its title).
-- Ids must match MOMENT_ICONS in components/MomentIcon.tsx. Writes go through
-- the existing "organizer writes moments" policy; nothing else changes.

alter table public.moments
  add column if not exists icon text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'moments_icon_check') then
    alter table public.moments
      add constraint moments_icon_check
      check (icon is null or icon in ('rings', 'cake', 'camera', 'glasses', 'music', 'food', 'flower', 'location', 'gift', 'heart', 'baby', 'sparkles'));
  end if;
end $$;
