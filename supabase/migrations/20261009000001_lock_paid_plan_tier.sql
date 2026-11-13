-- Paid plans can no longer be set from the app.
--
-- Until now the owner could write any plan_tier straight from the client
-- (the pricing screen's placeholder "Alege"), so anyone could give an event
-- Premium for free with one API call. From here on a signed-in user may only
-- set the free tier ('esential') or leave the plan as it is; a paid tier
-- ('complet', 'premium', 'agentie') is written only by the service role,
-- i.e. a server function that has verified a real store purchase.
--
-- Covers INSERT too: insertEvent could otherwise create an event that is
-- already Premium. Service role / cron have no auth.uid() and pass through.

create or replace function public.guard_event_owner_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / cron (album_status, verified purchases) have no auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.plan_tier is not null and new.plan_tier <> 'esential' then
      raise exception 'Paid plans can only be set after a verified purchase.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.organizer_id is distinct from old.organizer_id then
    raise exception 'The event owner cannot be changed.' using errcode = '42501';
  end if;

  if auth.uid() is distinct from old.organizer_id
     and (
       new.plan_tier is distinct from old.plan_tier
       or new.plan_purchased_at is distinct from old.plan_purchased_at
       or new.agency_id is distinct from old.agency_id
     ) then
    raise exception 'Only the event owner can change the plan.' using errcode = '42501';
  end if;

  -- The owner may pick the free tier; anything paid needs a verified purchase.
  if new.plan_tier is distinct from old.plan_tier
     and new.plan_tier is not null
     and new.plan_tier <> 'esential' then
    raise exception 'Paid plans can only be set after a verified purchase.' using errcode = '42501';
  end if;

  -- Never downgrade a paid plan from the client (e.g. re-picking Esențial).
  if old.plan_tier is not null
     and old.plan_tier <> 'esential'
     and new.plan_tier is distinct from old.plan_tier then
    raise exception 'A purchased plan cannot be changed from the app.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_event_owner_columns on public.events;
create trigger guard_event_owner_columns
  before insert or update on public.events
  for each row execute function public.guard_event_owner_columns();
