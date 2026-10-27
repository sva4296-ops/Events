-- AI help is now metered per event, by the event's plan, with the daily
-- per-account cap kept as an abuse guard (limits live in ai-write and are
-- mirrored in utils/aiLimits.ts): Esențial 10, Complet 100, Premium/Agenție
-- 300 per event; 150 per account per day. Calls that fail are refunded.

create table if not exists public.ai_event_usage (
  event_id uuid primary key references public.events (id) on delete cascade,
  count integer not null default 0
);

alter table public.ai_event_usage enable row level security;

-- Daily cap: now only counts a call while it's within the limit (it used to
-- count every attempt, so a burst of denied calls kept piling up).
create or replace function public.consume_ai_quota(p_user_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  insert into public.ai_usage (user_id, day, count)
  values (p_user_id, current_date, 0)
  on conflict (user_id, day) do nothing;

  update public.ai_usage
     set count = count + 1
   where user_id = p_user_id and day = current_date and count < p_limit
  returning count into used;
  return used is not null;
end;
$$;

create or replace function public.consume_ai_event_quota(p_event_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used integer;
begin
  insert into public.ai_event_usage (event_id, count)
  values (p_event_id, 0)
  on conflict (event_id) do nothing;

  update public.ai_event_usage
     set count = count + 1
   where event_id = p_event_id and count < p_limit
  returning count into used;
  return used is not null;
end;
$$;

-- Gives a call back when the AI request itself failed.
create or replace function public.refund_ai_quota(p_user_id uuid, p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage set count = greatest(count - 1, 0)
   where user_id = p_user_id and day = current_date;
  update public.ai_event_usage set count = greatest(count - 1, 0)
   where p_event_id is not null and event_id = p_event_id;
$$;

revoke all on function public.consume_ai_event_quota(uuid, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_quota(uuid, uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_event_quota(uuid, integer) to service_role;
grant execute on function public.refund_ai_quota(uuid, uuid) to service_role;

-- For the app's "N AI suggestions left" hint: organizers of the event only.
create or replace function public.get_ai_event_usage(p_event_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select count from public.ai_event_usage where event_id = p_event_id), 0)
   where public.is_event_organizer(p_event_id);
$$;

revoke all on function public.get_ai_event_usage(uuid) from public, anon;
grant execute on function public.get_ai_event_usage(uuid) to authenticated;
