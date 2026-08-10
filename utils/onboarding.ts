import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'povesteanoastra:onboarding-complete:v1:';

/**
 * Fast-path cache only — public.users.has_completed_onboarding is the source of
 * truth in Supabase mode; this just avoids a network round trip on every launch
 * once the answer is already known. Keyed per account id so a second account
 * signing in on the same device (or local mode's per-device identity) can't
 * inherit or clobber another account's state.
 */
export async function getOnboardingCache(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY_PREFIX + userId)) !== null;
  } catch {
    return false;
  }
}

export async function setOnboardingCache(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY_PREFIX + userId, new Date().toISOString());
  } catch {
    // Worst case the tutorial shows again next launch; not worth surfacing.
  }
}
