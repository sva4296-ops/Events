-- PovesteaNoastra — assign specific confirmed guests to a seating table,
-- instead of only a manual numeric seat count.
--
-- A nullable table_id FK on event_guests, not a separate table_assignments
-- join table: a guest can only sit at one table for a given event (there's
-- no scenario in this product where a single guest needs to belong to more
-- than one table at once), so the extra flexibility a join table would give
-- is never actually needed — a plain nullable FK is the simpler shape, same
-- "no join table unless the relationship is genuinely many-to-many"
-- reasoning already applied elsewhere in this schema (guest_user_id, etc.).
--
-- on delete set null: deleting a seating_tables row (app/detalii-seating's
-- swipe-to-delete) should free its guests, not fail or cascade-delete them.
--
-- No new RLS policy needed — "update own rsvp or as organizer"
-- (20260810000002_rls_policies.sql) already covers any column on a guest's
-- own row or, for the organizer, any guest row on an event they organize;
-- same reasoning already used for dietary_preferences (20260810000008).

alter table public.event_guests
  add column if not exists table_id uuid references public.seating_tables(id) on delete set null;

create index if not exists event_guests_table_id_idx on public.event_guests (table_id);
