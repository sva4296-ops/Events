import { supabase } from '@/data/supabaseClient';

/**
 * Push notification preferences (notification center). The catalog and the
 * server-side filter live in
 * supabase/migrations/20261007000003_notification_preferences.sql; every
 * sender goes through send_notification(), which skips users who switched a
 * type off.
 */

export type NotificationCategory = 'organizer' | 'reminders' | 'updates';

export interface NotificationType {
  key: string;
  category: NotificationCategory;
  defaultEnabled: boolean;
  /** Always sent, can't be switched off (event_cancelled). */
  locked: boolean;
}

interface NotificationTypeRow {
  key: string;
  category: NotificationCategory;
  default_enabled: boolean;
  locked: boolean;
}

export async function fetchNotificationTypes(): Promise<NotificationType[]> {
  const { data, error } = await supabase
    .from('notification_types')
    .select('key, category, default_enabled, locked')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as NotificationTypeRow[]).map((row) => ({
    key: row.key,
    category: row.category,
    defaultEnabled: row.default_enabled,
    locked: row.locked,
  }));
}

/** Only the user's overrides; a type with no entry uses its default. */
export async function fetchNotificationPreferences(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('type, enabled')
    .eq('user_id', userId);
  if (error) throw error;
  const result: Record<string, boolean> = {};
  for (const row of (data ?? []) as { type: string; enabled: boolean }[]) {
    result[row.type] = row.enabled;
  }
  return result;
}

/**
 * Back to the default = no row, so a later change of the default (in the
 * catalog) still reaches users who never really changed this type.
 */
export async function saveNotificationPreference(
  userId: string,
  type: NotificationType,
  enabled: boolean,
): Promise<void> {
  if (enabled === type.defaultEnabled) {
    const { error } = await supabase
      .from('notification_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('type', type.key);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: userId, type: type.key, enabled, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,type' },
    );
  if (error) throw error;
}
