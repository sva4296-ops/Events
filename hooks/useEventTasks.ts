import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  deleteEventTask,
  fetchEventTasks,
  saveEventTask,
  setEventTaskDone,
  type EventTask,
  type EventTaskInput,
} from '@/data/tasksRepository';
import { useAuth } from '@/hooks/useAuth';
import { useEvents } from '@/hooks/useEvents';
import { reportSupabaseError } from '@/utils/reportError';
import { syncTaskReminders } from '@/utils/taskReminders';
import { formatTaskWhen } from '@/utils/taskTime';

/** Runs reminder syncs one after another, so two quick changes can't interleave cancel/schedule. */
let syncChain: Promise<void> = Promise.resolve();

/**
 * The organizer checklist of one event. Only fetched for an organizer
 * (owner or co-organizer); RLS returns nothing to anyone else anyway.
 * `syncReminders` is set by the checklist screen only, so this device's
 * scheduled reminders are rebuilt from one place.
 */
export function useEventTasks(eventId: string, options: { syncReminders?: boolean } = {}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(eventId);
  const organizer = isOwner(event);
  const queryClient = useQueryClient();
  const queryKey = ['eventTasks', eventId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => fetchEventTasks(eventId),
    enabled: organizer && eventId.length > 0,
    staleTime: 30_000,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: (task: EventTaskInput) => {
      if (user === null) throw new Error('Not signed in.');
      return saveEventTask(eventId, user.id, task);
    },
    onSuccess: invalidate,
    onError: reportSupabaseError,
  });

  // Optimistic: the checkbox flips at once, reconciled on error.
  const toggleMutation = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => setEventTaskDone(id, done),
    onMutate: ({ id, done }) => {
      queryClient.setQueryData<EventTask[]>(queryKey, (current) =>
        current?.map((task) => (task.id === id ? { ...task, done } : task)),
      );
    },
    onError: (error) => {
      reportSupabaseError(error);
      invalidate();
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEventTask(id),
    onSuccess: invalidate,
    onError: reportSupabaseError,
  });

  const tasks = query.data;
  const eventName = event?.name ?? '';
  const sync = options.syncReminders === true;
  useEffect(() => {
    if (!sync || tasks === undefined) return;
    syncChain = syncChain.then(() =>
      syncTaskReminders(eventId, tasks, eventName, (task) =>
        task.dueAt === null ? '' : t('checklist.reminderBody', { when: formatTaskWhen(task.dueAt, t, i18n.language) }),
      ),
    );
  }, [sync, tasks, eventId, eventName, t, i18n.language]);

  return {
    tasks: tasks ?? [],
    hydrated: !organizer || query.isFetched,
    organizer,
    saveTask: (task: EventTaskInput) => saveMutation.mutateAsync(task).then(() => undefined, () => undefined),
    toggleTask: (id: string, done: boolean) => toggleMutation.mutate({ id, done }),
    deleteTask: (id: string) => deleteMutation.mutateAsync(id).then(() => undefined, () => undefined),
  };
}
