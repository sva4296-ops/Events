import type { Gradient } from '@/types/event';

/**
 * "Warm Story" theme tokens — the canonical light/dark palette for screens
 * migrated to ThemeProvider (see hooks/useTheme.tsx). Deliberately a third
 * token source alongside utils/theme.ts (organizer screens) and
 * utils/guestTheme.ts (guest tabs, still both light-mode-only) rather than a
 * replacement for either — same "separate palette per surface" precedent
 * those two already established. Screens read this file only once migrated;
 * see CLAUDE.md §2 for the running per-screen migration list.
 */

interface ShadowStyle {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: { width: number; height: number };
  elevation: number;
}

export interface ThemeTokens {
  mode: 'light' | 'dark';
  background: Gradient;
  surface: string;
  surfaceElevated: string;
  /** Light mode only — dark mode uses `surfaceBorder` instead (no shadow). */
  surfaceElevatedShadow: ShadowStyle | null;
  /** Dark mode only — a 1px border standing in for the shadow light mode uses. */
  surfaceBorder: string | null;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  accentGold: string;
  accentPink: string;
  statusConfirmed: string;
  statusConfirmedSoft: string;
  statusPending: string;
  statusPendingSoft: string;
  statusDeclined: string;
  statusDeclinedSoft: string;
  destructive: string;
  destructiveSoft: string;
  tabBar: {
    background: string;
    active: string;
    inactive: string;
  };
}

/** 16–18px everywhere a card rounds its corners; not mode-dependent. */
export const themeRadius = {
  sm: 12,
  md: 16,
  lg: 18,
  pill: 999,
} as const;

export const lightTheme: ThemeTokens = {
  mode: 'light',
  background: ['#FFF8F1', '#FBEAE0'],
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceElevatedShadow: {
    shadowColor: 'rgba(43,39,64,0.06)',
    shadowOpacity: 1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  surfaceBorder: null,
  textPrimary: '#2B2740',
  textSecondary: '#8A8496',
  accentPrimary: '#7F77DD',
  accentGold: '#F5C36B',
  accentPink: '#E8779E',
  statusConfirmed: '#2E9E6B',
  statusConfirmedSoft: '#E6F6EE',
  statusPending: '#C98A16',
  statusPendingSoft: '#FDF3E0',
  statusDeclined: '#7A6690',
  statusDeclinedSoft: '#F1EBF5',
  destructive: '#D9534F',
  destructiveSoft: '#FCEDEC',
  tabBar: {
    background: '#251F38',
    active: '#F5C36B',
    inactive: '#6E6684',
  },
};

export const darkTheme: ThemeTokens = {
  mode: 'dark',
  background: ['#1E1A30', '#171325'],
  surface: '#2A2440',
  surfaceElevated: '#2A2440',
  surfaceElevatedShadow: null,
  surfaceBorder: '#34304A',
  textPrimary: '#F3F1F8',
  textSecondary: '#9B93B8',
  accentPrimary: '#9B93F0',
  accentGold: '#F0C97D',
  accentPink: '#EE93B4',
  statusConfirmed: '#4FBE8D',
  statusConfirmedSoft: '#24402F',
  statusPending: '#F0C97D',
  statusPendingSoft: '#3A331F',
  statusDeclined: '#C5BFE8',
  statusDeclinedSoft: '#332C4F',
  destructive: '#E8726E',
  destructiveSoft: '#3A2229',
  tabBar: {
    background: '#0F0C1C',
    active: '#F0C97D',
    inactive: '#5E5678',
  },
};
