-- Organizer checklist per event ("mers la coafor, 12:00, reminder la 11:00").
-- Shared by the owner and co-organizers (is_event_organizer covers both);
-- guests and the restaurant role never see it.
--
-- Reminders are LOCAL notifications scheduled on the organizer's phone
-- (utils/taskReminders.ts), not server pushes: they work on iOS without APNs
-- and offline. remind_at is stored so every organizer's device can schedule
-- the same reminders when it loads the list.
create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  due_at timestamptz,
  -- Absolute time of the reminder; null = no reminder. Only meaningful with due_at.
  remind_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  constraint event_tasks_remind_needs_due check (remind_at is null or due_at is not null)
);

create index if not exists event_tasks_event_id_idx on public.event_tasks (event_id);

alter table public.event_tasks enable row level security;

-- One policy per action, all the same rule: you organize this event.
drop policy if exists "organizers read tasks" on public.event_tasks;
create policy "organizers read tasks" on public.event_tasks
  for select using (public.is_event_organizer(event_id));

drop policy if exists "organizers add tasks" on public.event_tasks;
create policy "organizers add tasks" on public.event_tasks
  for insert with check (public.is_event_organizer(event_id) and created_by = auth.uid());

drop policy if exists "organizers update tasks" on public.event_tasks;
create policy "organizers update tasks" on public.event_tasks
  for update using (public.is_event_organizer(event_id))
  with check (public.is_event_organizer(event_id));

drop policy if exists "organizers delete tasks" on public.event_tasks;
create policy "organizers delete tasks" on public.event_tasks
  for delete using (public.is_event_organizer(event_id));
