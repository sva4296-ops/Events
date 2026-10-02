-- Live video (demo): the organizer broadcasts from the app over WebRTC (WHIP)
-- to Cloudflare Stream; guests watch over WebRTC (WHEP).
--
-- One Cloudflare live input per event, created by the live-stream Edge
-- Function (service role). The WHIP (broadcast) URL is a credential and is
-- never stored here: the function fetches it from Cloudflare and hands it
-- only to an organizer. whep_url is the viewer URL, fine for anyone on the event.
-- Not recorded (Cloudflare does not record WHIP inputs).
--
-- share_token: public watch link for people who aren't at the event
-- (povestea-web /w/<token>, no account). Read only through get_live_by_token().

create table if not exists public.event_streams (
  event_id uuid primary key references public.events (id) on delete cascade,
  input_uid text not null,
  whep_url text not null,
  is_live boolean not null default false,
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  updated_at timestamptz not null default now()
);

alter table public.event_streams enable row level security;

drop policy if exists "view event stream" on public.event_streams;
create policy "view event stream" on public.event_streams
  for select using (public.can_view_event(event_id));

-- No insert/update/delete policies: only the live-stream function writes.

-- Public watch page (anon): only the event name/type and the viewer URL.
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
  select e.name, e.type, s.whep_url, s.is_live
  from public.event_streams s
  join public.events e on e.id = s.event_id
  where s.share_token = p_token
  limit 1;
$$;

revoke all on function public.get_live_by_token(text) from public;
grant execute on function public.get_live_by_token(text) to anon, authenticated;
