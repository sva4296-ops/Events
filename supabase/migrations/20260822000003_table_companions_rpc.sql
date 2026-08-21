-- PovesteaNoastra — let a guest see who else is confirmed at their own
-- seating table, without loosening event_guests' own RLS.
--
-- event_guests' only select policy is "guest_user_id = auth.uid() or
-- organizer" (20260810000002_rls_policies.sql) — a guest can read their own
-- row and nothing else, by design (same wall this file's own convention
-- already documents for public.users). A guest can't be handed a broader
-- SELECT on event_guests just to see co-assigned names; a narrow, purpose-
-- built security definer function is the same shape get_invite_preview()
-- already uses for the identical "the client needs one small slice it
-- couldn't otherwise see" problem.
--
-- The caller's own table is derived server-side from their own event_guests
-- row (guest_user_id = auth.uid()) — never taken as a client-supplied
-- parameter — so this can't be used to peek at an arbitrary table's guest
-- list. Returns nothing if the caller has no confirmed row on this event or
-- isn't assigned to a table yet.

create or replace function public.get_table_companions(p_event_id uuid)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  with me as (
    select table_id
    from public.event_guests
    where event_id = p_event_id
      and guest_user_id = auth.uid()
      and table_id is not null
    limit 1
  )
  select eg.id, coalesce(eg.guest_name, eg.guest_email, eg.guest_phone, 'Guest') as name
  from public.event_guests eg, me
  where eg.event_id = p_event_id
    and eg.table_id = me.table_id
    and eg.rsvp_status = 'confirmed'
    and eg.guest_user_id is distinct from auth.uid();
$$;

grant execute on function public.get_table_companions(uuid) to authenticated;
