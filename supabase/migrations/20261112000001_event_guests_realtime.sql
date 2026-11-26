-- Stream event_guests changes over Realtime, so the organizer's guest list
-- (web /event/[id]/guests) updates live when a guest confirms or declines.
-- RLS ("view guest list of visible events") still limits who receives what.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_guests'
  ) then
    alter publication supabase_realtime add table public.event_guests;
  end if;
end $$;
