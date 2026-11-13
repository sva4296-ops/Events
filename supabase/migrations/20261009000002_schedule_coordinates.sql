-- Map point per schedule item (ceremony at the church, party at the restaurant...),
-- picked on the in-app map in app/schedule/[id].tsx. Same shape as venue_info's.
-- Nullable: items without a point stay text-only.
alter table public.schedule_items
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.schedule_items
  drop constraint if exists schedule_items_coordinates_pair;
alter table public.schedule_items
  add constraint schedule_items_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );
