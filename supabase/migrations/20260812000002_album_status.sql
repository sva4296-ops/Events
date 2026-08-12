-- PovesteaNoastra — album lifecycle tracking. Live (real-time, thumbnails)
-- and Album (curated, full-quality, locked until ready) are now genuinely
-- different data states, not the same photo feed reused with a different
-- grid. Review before applying: supabase db push, or paste into the SQL
-- editor.

create type public.album_status as enum ('not_started', 'generating', 'ready');

alter table public.events
  add column if not exists album_status public.album_status not null default 'not_started';

-- Partial index: only rows still mid-lifecycle are ever scanned by the
-- scheduled transition in 20260812000003_album_status_cron.sql. Once a row
-- reaches 'ready' it drops out of the index for good, so this stays small
-- regardless of how many events accumulate over time.
create index if not exists events_album_status_idx
  on public.events (album_status)
  where album_status <> 'ready';
