-- The organizer's own line for the WhatsApp / SMS invitation (written by hand
-- or with AI on the send-invites screen). Replaces the default per-type line
-- in utils/whatsappInvite.ts; the greeting, date, place and personal link
-- around it stay automatic. Null/empty = the default line.
-- No RLS change: "organizer updates own event" already covers every column.
alter table public.events
  add column if not exists invite_intro text;

alter table public.events
  drop constraint if exists events_invite_intro_length;
alter table public.events
  add constraint events_invite_intro_length check (invite_intro is null or char_length(invite_intro) <= 400);
