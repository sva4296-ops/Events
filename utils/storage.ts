import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppEvent } from '@/types/event';

const EVENTS_KEY = 'povesteanoastra:events:v1';

export async function loadEvents(): Promise<AppEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(EVENTS_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppEvent[]) : [];
  } catch {
    return [];
  }
}

export async function saveEvents(events: readonly AppEvent[]): Promise<void> {
  try {
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events));
  } catch {
    // Persistence is best-effort in v1; in-memory state stays correct.
  }
}
