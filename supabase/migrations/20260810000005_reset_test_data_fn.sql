-- PovesteaNoastra — dev/test-only full data reset.
-- Truncates events, which cascades (via existing FKs) to event_guests,
-- schedule_items, venue_info, moments, moment_reactions, messages, fund, and
-- contributions, and photos. public.users and auth.users are untouched.
--
-- Deliberately NOT callable by anon or authenticated — only service_role, which
-- never ships in the app bundle. See scripts/reset-test-data.js.

create or replace function public.reset_test_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate table public.events cascade;
end;
$$;

revoke all on function public.reset_test_data() from public;
revoke all on function public.reset_test_data() from anon;
revoke all on function public.reset_test_data() from authenticated;
grant execute on function public.reset_test_data() to service_role;
