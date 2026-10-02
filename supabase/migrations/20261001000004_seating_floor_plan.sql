-- PovesteaNoastra: visual floor plan for the seating chart.
--
-- pos_x / pos_y are the table's CENTER in floor-plan units (1 unit = 1dp at
-- zoom 1x, see components/FloorPlan.tsx). Nullable on purpose: an older app
-- build that inserts a table without them still works, and the client places
-- a null-position table in the same grid slot this backfill uses.
--
-- shape: 'round' (default) or 'rect'.
--
-- No RLS changes: the existing "organizer writes seating" policy already
-- covers every column on seating_tables, and "view seating" covers reads.

alter table public.seating_tables
  add column if not exists pos_x integer,
  add column if not exists pos_y integer,
  add column if not exists shape text not null default 'round';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'seating_tables_shape_check'
  ) then
    alter table public.seating_tables
      add constraint seating_tables_shape_check check (shape in ('round', 'rect'));
  end if;
end $$;

-- Backfill: 3-column grid per event, 170 units apart, first center at
-- (110, 110). Must match gridSlot() in utils/floorPlan.ts.
with ordered as (
  select
    id,
    row_number() over (partition by event_id order by sort_order, id) - 1 as idx
  from public.seating_tables
  where pos_x is null or pos_y is null
)
update public.seating_tables st
set
  pos_x = 110 + (ordered.idx % 3) * 170,
  pos_y = 110 + (ordered.idx / 3) * 170
from ordered
where st.id = ordered.id;
