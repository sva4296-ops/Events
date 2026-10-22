-- Co-organizer labels (Mire, Mireasă, Naș, Nașă) are retired: the app now
-- offers only two roles, Co-organizator and Restaurant.
--
-- `relation` was a label only (20261002000003_event_member_relation.sql): it
-- never gave extra rights, `role` does. So clearing it changes nobody's access;
-- those members simply show as "Co-organizator" from now on.
-- Restaurant rows already have relation = null and role = 'restaurant': untouched.
--
-- The column and its check constraint stay, so older app builds that still
-- send a label keep working (their insert passes the check) until updated.

update public.event_members
set relation = null
where relation is not null;
