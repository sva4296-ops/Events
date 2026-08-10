import { brand } from '@/utils/guestTheme';

/** Shared geometry for the brand mark, used by both the splash and the header. */
export const MARK_PATH = 'M 16 112 C 70 112, 60 24, 168 24';
export const MARK_VIEWBOX = '0 0 184 136';
export const MARK_RATIO = 184 / 136;

/** Slightly over the real curve length, so the dash fully hides the stroke at rest. */
export const MARK_STROKE_LENGTH = 230;

export const MARK_STOPS = [
  { offset: '0', color: brand.gold },
  { offset: '0.5', color: brand.pink },
  { offset: '1', color: brand.purple },
] as const;
