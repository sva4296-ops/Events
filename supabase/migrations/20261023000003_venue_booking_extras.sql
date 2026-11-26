-- get_venue_booking() gains three fields for the venue night's Tonight tab
-- (was 20261023000002_venue_events.sql):
--   booked_people    people in confirmed bookings, across zones
--   booker_initials  initials of the latest 6 bookers ("AD"); never names,
--                    since customers can't read each other's bookings
--   upcoming         the same venue's next 3 nights (id, name, date, time,
--                    public token so each opens its own booking page)

create or replace function public.get_venue_booking(p_event_id uuid, p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_result jsonb;
begin
  select * into v_event from public.events where id = p_event_id and type = 'venue';
  if v_event.id is null then
    return null;
  end if;
  if not (public.can_view_event(p_event_id) or (p_token is not null and v_event.public_token = p_token)) then
    return null;
  end if;

  select jsonb_build_object(
    'event_id', v_event.id,
    'agency_id', v_event.agency_id,
    'name', v_event.name,
    'host_name', v_event.host_name,
    'event_date', v_event.event_date,
    'start_time', v_event.start_time,
    'location', v_event.location,
    'welcome_message', v_event.welcome_message,
    'price_info', v_event.price_info,
    'booking_times', to_jsonb(v_event.booking_times),
    'max_party_size', v_event.max_party_size,
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', z.id, 'name', z.name, 'detail', z.detail, 'capacity', z.capacity,
        'booked', coalesce((
          select sum(g.party_size) from public.event_guests g
          where g.zone_id = z.id and g.rsvp_status = 'confirmed'
        ), 0)
      ) order by z.sort_order, z.created_at)
      from public.venue_zones z where z.event_id = v_event.id
    ), '[]'::jsonb),
    'lineup', coalesce((
      select jsonb_agg(jsonb_build_object('time', s.time, 'title', s.title) order by s.sort_order, s.time)
      from public.schedule_items s where s.event_id = v_event.id
    ), '[]'::jsonb),
    'my_booking', (
      select jsonb_build_object(
        'guest_id', g.id, 'rsvp_status', g.rsvp_status, 'party_size', g.party_size,
        'zone_id', g.zone_id, 'booking_time', g.booking_time, 'booking_code', g.booking_code,
        'checked_in_at', g.checked_in_at
      )
      from public.event_guests g
      where g.event_id = v_event.id and g.guest_user_id = auth.uid()
      limit 1
    ),
    'following', exists (
      select 1 from public.venue_followers f
      where f.agency_id = v_event.agency_id and f.user_id = auth.uid()
    ),
    'booked_people', coalesce((
      select sum(g.party_size) from public.event_guests g
      where g.event_id = v_event.id and g.rsvp_status = 'confirmed'
    ), 0),
    'booker_initials', coalesce((
      select jsonb_agg(x.initials) from (
        select upper(
          left(split_part(trim(coalesce(g.guest_name, '?')), ' ', 1), 1) ||
          left(nullif(split_part(trim(coalesce(g.guest_name, '')), ' ', 2), ''), 1)
        ) as initials
        from public.event_guests g
        where g.event_id = v_event.id and g.rsvp_status = 'confirmed' and g.party_size is not null
        order by g.responded_at desc nulls last
        limit 6
      ) x
    ), '[]'::jsonb),
    'upcoming', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_id', e.id, 'name', e.name, 'event_date', e.event_date,
        'start_time', e.start_time, 'public_token', e.public_token
      ) order by e.event_date)
      from (
        select * from public.events e2
        where e2.agency_id = v_event.agency_id and v_event.agency_id is not null
          and e2.type = 'venue' and e2.id <> v_event.id
          and e2.event_date >= (now() at time zone 'Europe/Bucharest')::date
        order by e2.event_date
        limit 3
      ) e
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_venue_booking(uuid, text) from public, anon;
grant execute on function public.get_venue_booking(uuid, text) to authenticated;
