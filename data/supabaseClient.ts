import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// EXPO_PUBLIC_SUPABASE_KEY is the name Supabase's own quickstart uses; the
// _ANON_KEY spelling is accepted too so either env file works.
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (typeof url !== 'string' || url.length === 0 || typeof anonKey !== 'string' || anonKey.length === 0) {
  throw new Error(
    'Supabase is not configured: EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY (or ' +
      '_ANON_KEY) must be set in .env.local. There is no local/offline fallback mode — Supabase is ' +
      'a hard requirement.',
  );
}

export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No browser redirect to parse in a native app.
    detectSessionInUrl: false,
  },
});
