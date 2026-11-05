-- Public venue night page for the website (povestea-web /i/<public_token>),
-- readable signed out so the link works when posted on a status or story.
-- Returns only what the booking page shows anyway: the night, its zones with
-- free spots, the programme and how many people booked. No guest data.
-- Booking itself still needs a signed-in user (book_venue_event).

create or replace function public.get_venue_public(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'event_id', e.id,
    'agency_id', e.agency_id,
    'name', e.name,
    'host_name', e.host_name,
    'event_date', e.event_date,
    'start_time', e.start_time,
    'location', e.location,
    'welcome_message', e.welcome_message,
    'price_info', e.price_info,
    'booking_times', to_jsonb(e.booking_times),
    'max_party_size', e.max_party_size,
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id, 'name', z.name, 'detail', z.detail, 'capacity', z.capacity,
        'booked', coalesce((
          select sum(g.party_size) from public.event_guests g
          where g.zone_id = z.id and g.rsvp_status = 'confirmed'
        ), 0)
      ) order by z.sort_order, z.created_at)
      from public.venue_zones z where z.event_id = e.id
    ), '[]'::jsonb),
    'lineup', coalesce((
      select jsonb_agg(jsonb_build_object('time', s.time, 'title', s.title) order by s.sort_order, s.time)
      from public.schedule_items s where s.event_id = e.id
    ), '[]'::jsonb),
    'booked_people', coalesce((
      select sum(g.party_size) from public.event_guests g
      where g.event_id = e.id and g.rsvp_status = 'confirmed'
    ), 0)
  )
  from public.events e
  where e.public_token = p_token and e.type = 'venue';
$$;

revoke all on function public.get_venue_public(text) from public;
grant execute on function public.get_venue_public(text) to anon, authenticated;
