import { supabase } from '@/data/supabaseClient';

/**
 * App-wide switches from the app_settings table (flipped in the Supabase
 * dashboard, no release needed). See 20261002000007_app_settings.sql.
 */
export type AppSettingKey = 'live_video';

/** Missing row, missing table or an error all read as off. */
export async function fetchAppSetting(key: AppSettingKey): Promise<boolean> {
  const { data, error } = await supabase.from('app_settings').select('enabled').eq('key', key).maybeSingle();
  if (error) return false;
  return (data as { enabled: boolean } | null)?.enabled === true;
}
