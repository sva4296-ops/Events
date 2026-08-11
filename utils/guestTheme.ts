import { Platform } from 'react-native';

import type { Gradient } from '@/types/event';

/**
 * Design tokens for the guest event page. Kept separate from utils/theme.ts so
 * restyling the guest experience never touches the organizer screens.
 */
export const guest = {
  cream: '#FDF3EC',
  creamDeep: '#F7E7DA',
  blush: '#FBE3DD',
  navy: '#1B2237',
  navySoft: '#2A3149',
  purple: '#6C4CE0',
  purpleSoft: '#EFE9FF',
  gold: '#E8B54B',
  goldSoft: '#FBEFD5',
  ink: '#231C33',
  body: '#6B6480',
  faint: '#A79FB8',
  white: '#FFFFFF',
  line: '#EFE4DA',
  live: '#E8524F',
} as const;

export const fundGradient: Gradient = [guest.gold, guest.purple];

/** Splash + onboarding palette. */
export const brand = {
  cream: '#FDF3EC',
  gold: '#F5C36B',
  pink: '#E8779E',
  purple: '#7F77DD',
  navy: '#2B2740',
  lavender: '#EAE4F0',
  muted: '#8B8499',
} as const;

/**
 * Playfair Display loads in app/_layout.tsx; these platform serifs keep the
 * layout stable during the first frame and if loading ever fails.
 */
export const fonts = {
  displayRegular: 'PlayfairDisplay_400Regular',
  displayItalic: 'PlayfairDisplay_500Medium_Italic',
  displayBold: 'PlayfairDisplay_600SemiBold',
  serifFallback: Platform.select({ ios: 'Georgia', default: 'serif' }),
} as const;

export const gRadius = {
  sm: 12,
  md: 18,
  // Warm Story pass: cards land in the 16-18px window, not the old 26.
  lg: 18,
  xl: 32,
  pill: 999,
} as const;

export const gSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const gShadow = {
  shadowColor: '#3B2A1F',
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;
