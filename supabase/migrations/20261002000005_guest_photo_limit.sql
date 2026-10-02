-- Max 20 photos per guest per event (Album). Organizers and co-organizers
-- have no limit. Enforced here so a direct API call or the web upload page
-- can't bypass the app's check. Keep GUEST_PHOTO_LIMIT in utils/limits.ts in sync.
-- Service role / no session (auth.uid() null) is never blocked.

create or replace function public.enforce_guest_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null or public.is_event_organizer(new.event_id) then
    return new;
  end if;

  select count(*) into v_count
  from public.photos
  where event_id = new.event_id and uploaded_by = new.uploaded_by;

  if v_count >= 20 then
    raise exception 'Photo limit reached (max 20 per guest).' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_guest_photo_limit() from public, anon, authenticated;

drop trigger if exists enforce_guest_photo_limit on public.photos;
create trigger enforce_guest_photo_limit
  before insert on public.photos
  for each row execute function public.enforce_guest_photo_limit();
