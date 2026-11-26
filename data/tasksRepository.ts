import { supabase } from '@/data/supabaseClient';

/** An organizer checklist item (public.event_tasks). Times are ISO strings. */
export interface EventTask {
  id: string;
  eventId: string;
  title: string;
  dueAt: string | null;
  remindAt: string | null;
  done: boolean;
}

interface EventTaskRow {
  id: string;
  event_id: string;
  title: string;
  due_at: string | null;
  remind_at: string | null;
  done: boolean;
}

export interface EventTaskInput {
  id: string | null;
  title: string;
  dueAt: string | null;
  remindAt: string | null;
}

function mapTask(row: EventTaskRow): EventTask {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    dueAt: row.due_at,
    remindAt: row.remind_at,
    done: row.done,
  };
}

export async function fetchEventTasks(eventId: string): Promise<EventTask[]> {
  const { data, error } = await supabase
    .from('event_tasks')
    .select('id, event_id, title, due_at, remind_at, done')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as EventTaskRow[]).map(mapTask);
}

export async function saveEventTask(eventId: string, userId: string, task: EventTaskInput): Promise<void> {
  const fields = { title: task.title, due_at: task.dueAt, remind_at: task.remindAt };
  const { error } =
    task.id === null
      ? await supabase.from('event_tasks').insert({ ...fields, event_id: eventId, created_by: userId })
      : await supabase.from('event_tasks').update(fields).eq('id', task.id);
  if (error) throw error;
}

export async function setEventTaskDone(taskId: string, done: boolean): Promise<void> {
  const { error } = await supabase
    .from('event_tasks')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteEventTask(taskId: string): Promise<void> {
  const { error } = await supabase.from('event_tasks').delete().eq('id', taskId);
  if (error) throw error;
}
