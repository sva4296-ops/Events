-- Location per accommodation option (address text + optional map point),
-- picked in app/accommodation/[id].tsx. Same shape as schedule_items'
-- coordinates (20261009000002). Nullable: existing rows stay text-only.
alter table public.accommodations
  add column if not exists location text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.accommodations
  drop constraint if exists accommodations_coordinates_pair;
alter table public.accommodations
  add constraint accommodations_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );
