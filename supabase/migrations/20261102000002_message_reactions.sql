-- Emoji reactions on chat messages, WhatsApp style: one per person per message
-- (reacting again replaces it). event_id is copied onto the row so RLS and the
-- Realtime filter don't need a join. Purged with their message by the cascade.

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index if not exists message_reactions_event_idx on public.message_reactions (event_id);

alter table public.message_reactions enable row level security;

create policy "view message reactions" on public.message_reactions
  for select using (public.can_view_event(event_id));

create policy "react as yourself" on public.message_reactions
  for insert with check (
    user_id = auth.uid()
    and public.can_view_event(event_id)
    and exists (select 1 from public.messages m where m.id = message_id and m.event_id = message_reactions.event_id)
  );

create policy "change own reaction" on public.message_reactions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "remove own reaction" on public.message_reactions
  for delete using (user_id = auth.uid());

alter publication supabase_realtime add table public.message_reactions;
