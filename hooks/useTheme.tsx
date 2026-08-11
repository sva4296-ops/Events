import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkTheme, lightTheme, type ThemeTokens } from '@/utils/themeTokens';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'povesteanoastra:theme:v1';

interface ThemeContextValue {
  /** The resolved mode actually in effect — system scheme unless overridden. */
  mode: ThemeMode;
  /** Null means "follow system"; the Profile toggle always sets an explicit value. */
  override: ThemeMode | null;
  tokens: ThemeTokens;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  // Same "read cached preference once at startup" shape as utils/i18n.ts's
  // language restore — renders with the system-scheme guess for one frame,
  // then reconciles once AsyncStorage resolves. A saved choice wins once it
  // arrives, not before.
  useEffect(() => {
    void AsyncStorage.getItem(THEME_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setOverride(stored);
      }
    });
  }, []);

  const mode: ThemeMode = override ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const tokens = mode === 'dark' ? darkTheme : lightTheme;

  const setThemeMode = (next: ThemeMode) => {
    setOverride(next);
    void AsyncStorage.setItem(THEME_KEY, next);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, override, tokens, setThemeMode }),
    [mode, override, tokens],
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
