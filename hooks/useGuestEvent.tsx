import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useEvents } from '@/hooks/useEvents';
import type { AppEvent } from '@/types/event';

const FALLBACK_NAME = 'Evenimentul nostru';

interface GuestEventValue {
  id: string;
  name: string;
  event: AppEvent | undefined;
}

const GuestEventContext = createContext<GuestEventValue | null>(null);

/**
 * The `[id]` segment belongs to the tabs layout, and `useLocalSearchParams` in a
 * nested tab child does not see the parent's param — it returned undefined, which
 * silently blanked every tab. The layout reads the param once and passes it down.
 */
export function GuestEventProvider({ id, children }: { id: string; children: ReactNode }) {
  const { getEvent } = useEvents();
  const event = getEvent(id);

  const value = useMemo<GuestEventValue>(
    () => ({ id, name: event?.name ?? FALLBACK_NAME, event }),
    [id, event],
  );

  return <GuestEventContext.Provider value={value}>{children}</GuestEventContext.Provider>;
}

export function useGuestEvent(): GuestEventValue {
  const context = useContext(GuestEventContext);
  if (context === null) {
    throw new Error('useGuestEvent must be used inside <GuestEventProvider>');
  }
  return context;
}
