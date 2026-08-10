import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { EventDraft } from '@/types/event';

const EMPTY_DRAFT: EventDraft = {
  type: null,
  name: '',
  date: '',
  location: '',
  welcomeMessage: '',
};

interface EventDraftContextValue {
  draft: EventDraft;
  updateDraft: (patch: Partial<EventDraft>) => void;
  resetDraft: () => void;
}

const EventDraftContext = createContext<EventDraftContextValue | null>(null);

/** In-memory only: the wizard draft is not worth persisting in v1. */
export function EventDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<EventDraft>(EMPTY_DRAFT);

  const updateDraft = useCallback((patch: Partial<EventDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const value = useMemo<EventDraftContextValue>(
    () => ({ draft, updateDraft, resetDraft }),
    [draft, updateDraft, resetDraft],
  );

  return <EventDraftContext.Provider value={value}>{children}</EventDraftContext.Provider>;
}

export function useEventDraft(): EventDraftContextValue {
  const context = useContext(EventDraftContext);
  if (context === null) {
    throw new Error('useEventDraft must be used inside <EventDraftProvider>');
  }
  return context;
}
