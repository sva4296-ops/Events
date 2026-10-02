-- Co-organizer label: who they are to the couple (Mire, Mireasă, Naș, Nașă).
-- A label only: every co-organizer has the same rights
-- (20261002000002_event_co_organizers.sql). Null on rows added before this,
-- shown as the generic "Co-organizator". New values: extend the check.

alter table public.event_members
  add column if not exists relation text;

alter table public.event_members
  drop constraint if exists event_members_relation_check;

alter table public.event_members
  add constraint event_members_relation_check
  check (relation is null or relation in ('groom', 'bride', 'godfather', 'godmother'));
