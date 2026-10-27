import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { EventTypeId } from '@/types/event';
import { eventAccentTokens } from '@/utils/eventAccent';
import { DEFAULT_THEME, THEME_IDS, THEMES, type ThemeId, type ThemeTokens } from '@/utils/themeTokens';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'povesteanoastra:theme:v2';
/** v1 stored 'light'/'dark'; mapped onto the closest new theme once. */
const LEGACY_THEME_KEY = 'povesteanoastra:theme:v1';

interface ThemeContextValue {
  /** Whether the active theme is light or dark (status bar, pickers, maps). */
  mode: ThemeMode;
  themeId: ThemeId;
  tokens: ThemeTokens;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemeId(value: string | null): value is ThemeId {
  return value !== null && (THEME_IDS as readonly string[]).includes(value);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);

  // Read the saved choice once at startup (same shape as the language restore).
  useEffect(() => {
    void AsyncStorage.multiGet([THEME_KEY, LEGACY_THEME_KEY]).then((pairs) => {
      const stored = pairs[0]?.[1] ?? null;
      const legacy = pairs[1]?.[1] ?? null;
      if (isThemeId(stored)) setThemeIdState(stored);
      else if (legacy === 'dark') setThemeIdState('bleumarin');
    });
  }, []);

  const tokens = THEMES[themeId];
  const mode: ThemeMode = tokens.mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      themeId,
      tokens,
      setThemeId: (next: ThemeId) => {
        setThemeIdState(next);
        void AsyncStorage.setItem(THEME_KEY, next);
      },
    }),
    [mode, themeId, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}

/**
 * Inside an event's screens: same theme, but the accent (buttons, switches,
 * + button, active tab) in the event type's color. Cards and text unchanged.
 * Pass null to keep the app's purple.
 */
export function EventAccentProvider({ type, children }: { type: EventTypeId | null; children: ReactNode }) {
  const parent = useTheme();
  const value = useMemo<ThemeContextValue>(
    () => (type === null ? parent : { ...parent, tokens: { ...parent.tokens, ...eventAccentTokens(type, parent.tokens) } }),
    [parent, type],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
