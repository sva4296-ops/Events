-- TESTING ONLY: temporarily lets the event owner set any plan_tier from the
-- app, paid tiers included, without a verified purchase (pairs with
-- PAID_PLANS_FOR_TESTING in utils/features.ts).
--
-- Same function as 20261009000001_lock_paid_plan_tier.sql minus its three
-- paid-plan checks. Still enforced: the owner can't be changed, and only the
-- owner (not co-organizers) can change the plan.
--
-- BEFORE LAUNCH: add a new migration that re-creates the locked version from
-- 20261009000001_lock_paid_plan_tier.sql, otherwise anyone can give an event
-- a paid plan for free with one API call.

create or replace function public.guard_event_owner_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / cron have no auth.uid().
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
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

  return new;
end;
$$;
