alter table public.event_guests
add column if not exists invite_seen_at timestamptz;

-- SITE: pagina /i/<token>. Invitatul poate să nu aibă cont, îl găsim după token.
create or replace function public.mark_invite_seen_by_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.event_guests
  set invite_seen_at = now()
  where invite_token = p_token and invite_seen_at is NULL;
$$;

revoke all on function public.mark_invite_seen_by_token(text) from public;
grant execute
on function public.mark_invite_seen_by_token(text)
to anon, authenticated;

-- APLICAȚIE: ecranul de invitație. Invitatul e autentificat, îl găsim după cont.
create or replace function public.mark_invite_seen(p_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.event_guests
  set invite_seen_at = now()
  where
    event_id = p_event_id
    and guest_user_id = auth.uid()
    and invite_seen_at is NULL;
$$;

revoke all on function public.mark_invite_seen(uuid) from public, anon;
grant execute on function public.mark_invite_seen(uuid) to authenticated;
