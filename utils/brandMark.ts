import { brandGradient } from '@/utils/themeTokens';

/**
 * Warm Story 2.0 brand mark: the "story thread", a wave from a gold dot
 * (the beginning) to a purple dot (the recap). Shared by BrandMark, the
 * animated BrandSplash and BrandFlourish; the app icon and splash PNGs in
 * assets/ are rendered from the same geometry.
 */
export const MARK_PATH = 'M5 28C15 28 17 8 29 8S43 30 55 12';
export const MARK_VIEWBOX = '0 0 60 36';
export const MARK_RATIO = 60 / 36;

/** Start (gold) and end (purple) dots, in viewBox units. */
export const MARK_START = { x: 5, y: 28 } as const;
export const MARK_END = { x: 55, y: 12 } as const;
export const MARK_DOT_RADIUS = 3.6;
export const MARK_STROKE_WIDTH = 4;

/** Slightly over the real curve length (~65.5), so the dash fully hides the stroke at rest. */
export const MARK_STROKE_LENGTH = 68;

/** Horizontal gold → pink → purple, like the design's thread. */
export const MARK_STOPS = [
  { offset: '0', color: brandGradient[0] },
  { offset: '0.5', color: brandGradient[1] },
  { offset: '1', color: brandGradient[2] },
] as const;
