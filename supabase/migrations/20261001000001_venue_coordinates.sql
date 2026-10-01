-- Venue coordinates, picked on the in-app map (app/venue/[id].tsx).
-- Nullable: venues typed in by hand before this stay text-only, and guests
-- then get a navigation link built from the address instead.
alter table public.venue_info
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.venue_info
  drop constraint if exists venue_info_coordinates_pair;
alter table public.venue_info
  add constraint venue_info_coordinates_pair check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  );
