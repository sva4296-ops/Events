import { Alert } from 'react-native';

/** Shared failure surface for fire-and-forget Supabase writes. */
export function reportSupabaseError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Please try again.';
  Alert.alert('Something went wrong', message);
}
