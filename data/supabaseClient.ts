import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
// EXPO_PUBLIC_SUPABASE_KEY is the name Supabase's own quickstart uses; the
// _ANON_KEY spelling is accepted too so either env file works.
const anonKey =
  process.env.EXPO_PUBLIC_SUPABASE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once both env vars are set. Everything auth-related degrades to a local
 * identity when they are absent, so the app still runs without a backend.
 */
export const isSupabaseConfigured =
  typeof url === 'string' && url.length > 0 && typeof anonKey === 'string' && anonKey.length > 0;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No browser redirect to parse in a native app.
        detectSessionInUrl: false,
      },
    })
  : null;
