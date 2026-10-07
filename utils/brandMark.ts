import { brandGradient } from '@/utils/themeTokens';

/**
 * Warm Story 2.0 brand mark: the "story thread with a heart". A thread runs
 * from a gold dot (the beginning), loops into a heart, and ends at a purple
 * dot (the recap). Shared by BrandMark and the animated BrandSplash; the app
 * icon and splash PNGs in assets/ are rendered from the same geometry.
 */
export const MARK_PATH =
  'M8 66C22 66 38 72 50 82C26 64 20 40 32 30C40 23 50 28 50 38C50 28 60 23 68 30C80 40 74 64 50 82C62 72 78 66 92 66';
export const MARK_VIEWBOX = '0 20 100 68';
export const MARK_RATIO = 100 / 68;
/** Width of the mark's coordinate space, for userSpaceOnUse gradients. */
export const MARK_UNITS_WIDTH = 100;

/** Start (gold) and end (purple) dots, in viewBox units. */
export const MARK_START = { x: 8, y: 66 } as const;
export const MARK_END = { x: 92, y: 66 } as const;
export const MARK_DOT_RADIUS = 6;
export const MARK_STROKE_WIDTH = 6.5;

/** Slightly over the real curve length (~267.2), so a dash can fully clear the stroke. */
export const MARK_STROKE_LENGTH = 270;

/** Horizontal gold → pink → purple, like the design's thread. */
export const MARK_STOPS = [
  { offset: '0', color: brandGradient[0] },
  { offset: '0.5', color: brandGradient[1] },
  { offset: '1', color: brandGradient[2] },
] as const;

/**
 * The original plain wave, kept only for BrandFlourish's decorative corner
 * accent: a stretched heart doesn't read as a sliver, a wave does.
 */
export const FLOURISH_PATH = 'M5 28C15 28 17 8 29 8S43 30 55 12';
export const FLOURISH_VIEWBOX = '0 0 60 36';
