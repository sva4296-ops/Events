-- Daily AI-writing quota per user, for the ai-write Edge Function.
--
-- The function calls consume_ai_quota() with the service role before every
-- generation; it counts the call and says whether it's still within the
-- limit. Nothing in the app reads or writes this table directly: RLS is on
-- with no policies, and the function is executable by service_role only.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  count integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;

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
  values (p_user_id, current_date, 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1
  returning count into used;
  return used <= p_limit;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
