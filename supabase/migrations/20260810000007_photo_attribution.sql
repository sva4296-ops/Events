-- PovesteaNoastra — photo uploader attribution.
-- Denormalized, same pattern as messages.sender_label and for the same reason:
-- public.users' only select policy is "id = auth.uid()", so a live client-side
-- join from another guest's session would silently return null for anyone but
-- themselves. The uploader's own session can read their own display_name at
-- upload time and store it here instead of joining at read time.

alter table public.photos
  add column if not exists uploaded_by_label text;

-- One-time backfill for rows that predate this column. Safe to re-run — only
-- touches rows still missing a label.
update public.photos p
set uploaded_by_label = u.display_name
from public.users u
where p.uploaded_by = u.id
  and p.uploaded_by_label is null;
