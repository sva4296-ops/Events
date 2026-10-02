-- App-wide on/off switches, flipped from the Supabase dashboard (Table Editor >
-- app_settings) without an app release. Readable by everyone; written only
-- from the dashboard / service role (no write policies).
--
-- live_video: the Live tab's video. Off = the app shows "coming soon", the
-- live-stream function refuses to start, and public watch links show
-- "not started yet".

create table if not exists public.app_settings (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app settings are readable" on public.app_settings;
create policy "app settings are readable" on public.app_settings
  for select using (true);

insert into public.app_settings (key, enabled)
values ('live_video', false)
on conflict (key) do nothing;

create or replace function public.app_setting_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.app_settings where key = p_key), false);
$$;

-- Public watch page: never "live" while the switch is off
-- (was 20261002000004_event_streams.sql).
create or replace function public.get_live_by_token(p_token text)
returns table (
  event_name text,
  event_type public.event_type,
  whep_url text,
  is_live boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.name, e.type, s.whep_url, s.is_live and public.app_setting_enabled('live_video')
  from public.event_streams s
  join public.events e on e.id = s.event_id
  where s.share_token = p_token
  limit 1;
$$;

revoke all on function public.get_live_by_token(text) from public;
grant execute on function public.get_live_by_token(text) to anon, authenticated;
