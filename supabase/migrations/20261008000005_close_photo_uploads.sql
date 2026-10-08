-- No new album photos once 3 full days have passed since the event (it was
-- on the 5th -> uploads close on the 9th, Europe/Bucharest), for everyone,
-- organizers included. That's also when the album turns 'ready' and the story
-- appears. Events without a date stay open. Service role / no session is
-- never blocked. Keep PHOTO_UPLOAD_DAYS_AFTER in utils/limits.ts in sync.

create or replace function public.enforce_photo_upload_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date date;
begin
  if auth.uid() is null then
    return new;
  end if;

  select event_date into v_event_date from public.events where id = new.event_id;

  if v_event_date is not null
     and (now() at time zone 'Europe/Bucharest')::date > v_event_date + 3 then
    raise exception 'The album is closed: photos can be added up to 3 days after the event.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_photo_upload_window() from public, anon, authenticated;

drop trigger if exists enforce_photo_upload_window on public.photos;
create trigger enforce_photo_upload_window
  before insert on public.photos
  for each row execute function public.enforce_photo_upload_window();
