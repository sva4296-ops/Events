-- Numbers for the post-event story (app/story/[id].tsx) that a guest can't
-- count client-side: RLS shows a guest only their own event_guests row.
-- Anyone who can see the event gets the count; others get 0.

create or replace function public.event_story_confirmed_guests(p_event_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.can_view_event(p_event_id) then (
      select count(*)::int
      from public.event_guests g
      where g.event_id = p_event_id and g.rsvp_status = 'confirmed'
    )
    else 0
  end;
$$;

revoke all on function public.event_story_confirmed_guests(uuid) from public, anon;
grant execute on function public.event_story_confirmed_guests(uuid) to authenticated;

create or replace function public.notify_on_album_ready()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.album_status <> 'ready' or old.album_status = 'ready' then
    return new;
  end if;

  perform public.send_notification(
    public.confirmed_guest_ids(new.id) || public.event_organizer_ids(new.id),
    'album_ready',
    jsonb_build_object('url', '/story/' || new.id),
    jsonb_build_object(
      'title', 'Povestea de la ' || new.name || ' e gata ✨',
      'body', 'Momentele, programul și pozele, într-un story. Toate pozele sunt și în album.'
    ),
    jsonb_build_object(
      'title', 'The story of ' || new.name || ' is ready ✨',
      'body', 'The moments, the schedule and the photos, in one story. All photos are in the album too.'
    )
  );
  return new;
end;
$$;

revoke all on function public.notify_on_album_ready() from public, anon, authenticated;
