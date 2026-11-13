import { createContext, type ReactNode } from 'react';

/** What the event's tabs layout draws at the top of each tab (see app/guest/[id]/_layout.tsx). */
export interface EventChromeValue {
  /** The cover hero, for Acasă (GuestScreen's `showHero`). */
  hero: ReactNode;
}

export const EventChromeContext = createContext<EventChromeValue | null>(null);

/** Where a dark cover ends, for the status bar; scroll events come from whichever list holds it. */
export const CoverStatusContext = createContext<{
  reportHeroBottom: (bottom: number | null) => void;
  onScrollY: (y: number) => void;
} | null>(null);
