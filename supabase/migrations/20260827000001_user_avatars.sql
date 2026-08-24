-- PovesteaNoastra — private Storage bucket for profile avatars.
-- Same shape as 20260812000001_event_photos_storage.sql's event-photos
-- bucket: private, every read goes through a signed URL, never a public one.
-- Review before applying: supabase db push, or paste into the SQL editor.

-- ---------------------------------------------------------------------------
-- Bucket. One object per user, path convention `{userId}/avatar.jpg` — fully
-- derivable from auth.uid(), so (like event photo paths) no new column is
-- needed on public.users to track it; data/usersRepository.ts's
-- fetchAvatarUrl treats a missing object as "no avatar yet" (createSignedUrl
-- returns an error, not a URL, for a path that doesn't exist).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- storage.objects RLS. Narrower than event-photos on purpose: an avatar is
-- personal, not shared with anyone else on an event, so every policy is
-- scoped to the caller's own path prefix only — (storage.foldername(name))[1]
-- is always the userId segment. Update policy is required alongside insert
-- because uploadUserAvatar always re-uploads to the same path with
-- `upsert: true`, which the storage API resolves as an update once the
-- object already exists.
--
-- Same "check both owner and owner_id" reasoning as the event-photos
-- migration — Supabase Storage has used both column names across project
-- versions.
-- ---------------------------------------------------------------------------
create policy "view own avatar" on storage.objects
  for select using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "upload own avatar" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (owner = auth.uid() or owner_id = auth.uid()::text)
  );

create policy "replace own avatar" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
