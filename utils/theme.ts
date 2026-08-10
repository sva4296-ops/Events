import type { Gradient } from '@/types/event';

export const colors = {
  text: '#1A1330',
  muted: '#6F6889',
  faint: '#A8A2BC',
  card: '#FFFFFF',
  border: '#EDE9F7',
  primary: '#6C4CE0',
  primarySoft: '#F1ECFF',
  onPrimary: '#FFFFFF',
  success: '#2E9E6B',
  successSoft: '#E6F6EE',
  danger: '#D9534F',
  dangerSoft: '#FCEDEC',
  warning: '#C98A16',
  warningSoft: '#FDF3E0',
} as const;

/** Default page background gradient. */
export const screenGradient: Gradient = ['#FBF8FF', '#F2F5FF'];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const shadow = {
  shadowColor: '#2B1A62',
  shadowOpacity: 0.08,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 3,
} as const;
