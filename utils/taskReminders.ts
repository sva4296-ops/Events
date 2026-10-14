import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { EventTask } from '@/data/tasksRepository';
import { captureError } from '@/utils/sentry';

const KIND = 'task_reminder';

/** Notification permission for reminders; asks once if it hasn't been decided yet. */
export async function ensureReminderPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notificări',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const existing = await Notifications.getPermissionsAsync();
    return existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Makes this device's scheduled reminders for one event match its checklist:
 * cancels the ones it scheduled before, then schedules one per open task
 * whose reminder is still in the future. Cheap and idempotent, so it runs
 * every time the list loads or changes (that's also how a co-organizer's
 * phone picks up reminders someone else set).
 */
export async function syncTaskReminders(
  eventId: string,
  tasks: EventTask[],
  eventName: string,
  bodyFor: (task: EventTask) => string,
): Promise<void> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((request) => {
          const data = request.content.data as { type?: unknown; event_id?: unknown } | undefined;
          return data?.type === KIND && data.event_id === eventId;
        })
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );

    const now = Date.now();
    for (const task of tasks) {
      if (task.done || task.remindAt === null) continue;
      const at = new Date(task.remindAt);
      if (at.getTime() <= now) continue;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: task.title,
          body: `${eventName} · ${bodyFor(task)}`,
          data: { type: KIND, event_id: eventId, url: `/checklist/${eventId}` },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: at,
          channelId: 'default',
        },
      });
    }
  } catch (error) {
    captureError(error);
  }
}
