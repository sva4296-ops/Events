-- PovesteaNoastra — private Storage bucket for event photos.
-- Replaces the old "photos.url holds whatever local device URI ImagePicker
-- returned" behavior (never resolved off the originating device) with real
-- dual-resolution uploads to Supabase Storage. Review before applying:
-- supabase db push, or paste into the SQL editor.

-- ---------------------------------------------------------------------------
-- Bucket. Private — every read goes through a signed URL (createSignedUrl(s)),
-- never a public URL, since the bucket has no public grant. Size cap and
-- mime restriction are a small addition beyond spec: the app's own upload
-- pipeline always saves both versions as JPEG, so nothing legitimate should
-- ever need to upload anything else here. Strip file_size_limit/
-- allowed_mime_types if you'd rather not restrict it.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', false, 10485760, array['image/jpeg'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- storage.objects RLS. Path convention: {eventId}/{photoId}/thumb.jpg and
-- {eventId}/{photoId}/full.jpg. storage.foldername(name) returns the path
-- segments before the filename, so [1] is always the eventId — cast to uuid
-- and checked against the same public.can_view_event / is_event_organizer
-- helpers the `photos` table's own RLS already uses
-- (20260810000002_rls_policies.sql), so "can see the photos row" and "can
-- fetch/upload the underlying file" can't drift apart.
--
-- Note on "confirmed RSVP": the existing `photos` table policies (view/
-- upload) gate on can_view_event(), which only requires an event_guests row
-- to exist — any rsvp_status, including 'pending' — not literally
-- rsvp_status = 'confirmed'. This mirrors that exactly, on purpose: a
-- stricter confirmed-only gate here (and not on the table too) would let a
-- not-yet-responded guest create a `photos` row but fail to upload the
-- actual file, which would just look like a broken upload button. Change
-- both together if you actually want the stricter behavior.
--
-- Note on ownership column: Supabase Storage has both `owner` (uuid) and a
-- newer `owner_id` (text) column across project versions, set server-side
-- from the uploader's auth token. Checking both makes this correct
-- regardless of which your project populates — verify against your actual
-- storage.objects columns if either policy permits/denies more than
-- expected.
-- ---------------------------------------------------------------------------
create policy "view event photos" on storage.objects
  for select using (
    bucket_id = 'event-photos'
    and public.can_view_event((storage.foldername(name))[1]::uuid)
  );

create policy "upload event photos as yourself" on storage.objects
  for insert with check (
    bucket_id = 'event-photos'
    and (owner = auth.uid() or owner_id = auth.uid()::text)
    and public.can_view_event((storage.foldername(name))[1]::uuid)
  );

create policy "delete own event photo or as organizer" on storage.objects
  for delete using (
    bucket_id = 'event-photos'
    and (
      owner = auth.uid() or owner_id = auth.uid()::text
      or public.is_event_organizer((storage.foldername(name))[1]::uuid)
    )
  );

-- ---------------------------------------------------------------------------
-- photos.url becomes optional. Thumb/full storage paths are fully derived by
-- convention from (event_id, id), so no new columns are needed to store
-- them. New rows leave `url` null; existing rows keep whatever local device
-- URI they already had — harmless dead data, since those never resolved off
-- the originating device anyway (see CLAUDE.md §7).
-- ---------------------------------------------------------------------------
alter table public.photos alter column url drop not null;
