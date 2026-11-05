-- Moments: who posted it, and who may edit it.
--
--   1. moments.author_label: the poster's name, shown on the card. Copied
--      from users.display_name at insert (public.users is only readable by
--      its own row, so guests can't join it), same idea as messages.sender_label.
--   2. Edit / delete: your own moments, and the event owner can also edit or
--      delete any co-organizer's moment. Co-organizers can't touch each
--      other's or the owner's.
--
-- Bug this also fixes: "organizer writes moments" (20260810000002_rls_policies.sql)
-- was one FOR ALL policy whose WITH CHECK required organizer_id = auth.uid().
-- On UPDATE the row keeps the poster's organizer_id, so the owner editing a
-- co-organizer's moment failed with 42501.

-- ---------------------------------------------------------------------------
-- 1. Author name
-- ---------------------------------------------------------------------------
alter table public.moments add column if not exists author_label text;

create or replace function public.set_moment_author_label()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select nullif(trim(u.display_name), '') into new.author_label
  from public.users u
  where u.id = new.organizer_id;
  return new;
end;
$$;

revoke all on function public.set_moment_author_label() from public, anon, authenticated;

drop trigger if exists set_moment_author_label on public.moments;
create trigger set_moment_author_label
  before insert on public.moments
  for each row execute function public.set_moment_author_label();

update public.moments m
set author_label = nullif(trim(u.display_name), '')
from public.users u
where u.id = m.organizer_id
  and m.author_label is null;

-- ---------------------------------------------------------------------------
-- 2. Policies
-- ---------------------------------------------------------------------------
drop policy if exists "organizer writes moments" on public.moments;
drop policy if exists "organizer posts moments" on public.moments;
drop policy if exists "organizer edits moments" on public.moments;
drop policy if exists "organizer deletes moments" on public.moments;

-- Post: any organizer, as yourself.
create policy "organizer posts moments" on public.moments
  for insert with check (public.is_event_organizer(event_id) and organizer_id = auth.uid());

-- Edit: your own (while you're an organizer), or any if you own the event.
create policy "organizer edits moments" on public.moments
  for update using (
    public.is_event_owner(event_id)
    or (organizer_id = auth.uid() and public.is_event_organizer(event_id))
  )
  with check (public.is_event_organizer(event_id));

-- Delete: same rule as edit.
create policy "organizer deletes moments" on public.moments
  for delete using (
    public.is_event_owner(event_id)
    or (organizer_id = auth.uid() and public.is_event_organizer(event_id))
  );

-- The poster, their name and the event never change on edit (a policy can't
-- compare old and new values, so a trigger pins them).
create or replace function public.keep_moment_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.organizer_id := old.organizer_id;
  new.author_label := old.author_label;
  new.event_id := old.event_id;
  return new;
end;
$$;

drop trigger if exists keep_moment_author on public.moments;
create trigger keep_moment_author
  before update on public.moments
  for each row execute function public.keep_moment_author();
