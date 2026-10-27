import type { EventTypeId, SpontaneousTemplate } from '@/types/event';
import type { ThemeTokens } from '@/utils/themeTokens';

/**
 * Cover themes an organizer picks in the create wizard (app/create/theme.tsx).
 * Drawn in code by components/CoverArt.tsx: a base gradient, two soft glows
 * and one decoration. Saved as events.cover_theme; null = the static
 * per-type cover photo (utils/eventCovers.ts).
 */

export type CoverDecoration =
  | 'rings'
  | 'confetti'
  | 'sparkles'
  | 'bars'
  | 'disco'
  | 'neon'
  | 'fireworks'
  | 'tree'
  | 'moon'
  | 'hearts'
  | 'gold'
  | 'crescent'
  | 'balloons'
  | 'leaf'
  | 'sun'
  | 'aurora'
  | 'grid'
  | 'cap'
  | 'plate'
  | 'line';

export interface CoverTheme {
  id: string;
  /** Base gradient, top-left to bottom-right. */
  colors: readonly [string, string, string];
  /** Two soft glows: [color, x 0-1, y 0-1]. */
  glows: readonly [readonly [string, number, number], readonly [string, number, number]];
  decoration: CoverDecoration;
  /** Color of the decoration's strokes and dots. */
  ink: string;
  /** Accent inside the event (buttons, tabs, progress) when this theme is picked. */
  accent: string;
  /** Text over the cover: light themes get dark text. */
  light: boolean;
}

export const COVER_THEMES: readonly CoverTheme[] = [
  { id: 'petrecere', accent: '#8E5CFF', colors: ['#3A1C5C', '#5B2A86', '#2A1446'], glows: [['#E8579A', 0.15, 0.2], ['#7B5CFF', 0.85, 0.55]], decoration: 'rings', ink: '#C9B8FF', light: false },
  { id: 'aniversare', accent: '#D9603F', colors: ['#7A2E3A', '#C2563F', '#4A1E3A'], glows: [['#FFB070', 0.75, 0.3], ['#E8579A', 0.2, 0.75]], decoration: 'confetti', ink: '#FFE2C2', light: false },
  { id: 'local', accent: '#6A5CE0', colors: ['#2A2266', '#4B3A9E', '#1C1850'], glows: [['#E8579A', 0.2, 0.25], ['#B79CFF', 0.85, 0.2]], decoration: 'sparkles', ink: '#FFFFFF', light: false },
  { id: 'karaoke', accent: '#C2318E', colors: ['#3B0F45', '#7A1F6B', '#24103A'], glows: [['#FF4FA3', 0.15, 0.3], ['#8E5CFF', 0.85, 0.75]], decoration: 'bars', ink: '#F4D6FF', light: false },
  { id: 'disco', accent: '#7B5CFF', colors: ['#1E1446', '#4A2A86', '#14102E'], glows: [['#FF6FB5', 0.2, 0.75], ['#9C8CFF', 0.75, 0.25]], decoration: 'disco', ink: '#FFFFFF', light: false },
  { id: 'neon', accent: '#1FA8B6', colors: ['#0B0F1A', '#121826', '#0A0C14'], glows: [['#2FD3E0', 0.8, 0.2], ['#B05CFF', 0.2, 0.8]], decoration: 'neon', ink: '#6FF1FF', light: false },
  { id: 'revelion', accent: '#C9922E', colors: ['#0E1430', '#1A2350', '#0A0F24'], glows: [['#F2B544', 0.5, 0.95], ['#5B6BFF', 0.2, 0.2]], decoration: 'fireworks', ink: '#FFD27A', light: false },
  { id: 'craciun', accent: '#C8382E', colors: ['#0F3B2A', '#1D5A3C', '#5A1A1E'], glows: [['#E0453A', 0.85, 0.15], ['#3FB57E', 0.2, 0.7]], decoration: 'tree', ink: '#FFE9C9', light: false },
  { id: 'halloween', accent: '#D9701A', colors: ['#1A1020', '#2B1638', '#120A16'], glows: [['#FF8A2A', 0.7, 0.35], ['#6A2A9E', 0.2, 0.85]], decoration: 'moon', ink: '#FFC46B', light: false },
  { id: 'nunta', accent: '#C2788A', colors: ['#F6D9D4', '#E9C4C8', '#F3E3DA'], glows: [['#FFFFFF', 0.25, 0.25], ['#E2A6B4', 0.8, 0.8]], decoration: 'hearts', ink: '#FFFFFF', light: true },
  { id: 'elegant', accent: '#B08A42', colors: ['#141210', '#1E1A14', '#0E0C0A'], glows: [['#C9A55C', 0.55, 0.45], ['#5A4422', 0.2, 0.9]], decoration: 'gold', ink: '#D9B972', light: false },
  { id: 'botez', accent: '#5E8CCB', colors: ['#D8E8FA', '#E3DDF7', '#F4E6F1'], glows: [['#FFFFFF', 0.3, 0.3], ['#B9D6FF', 0.8, 0.7]], decoration: 'crescent', ink: '#FFFFFF', light: true },
  { id: 'copii', accent: '#D9709A', colors: ['#FFF0B8', '#FFE1E8', '#E8F5D6'], glows: [['#FFFFFF', 0.3, 0.3], ['#FFC0D4', 0.8, 0.8]], decoration: 'balloons', ink: '#FFFFFF', light: true },
  { id: 'gradina', accent: '#43965E', colors: ['#E4F7C9', '#C9F0D2', '#F2F9DE'], glows: [['#FFFFFF', 0.3, 0.3], ['#A6E3B8', 0.85, 0.75]], decoration: 'leaf', ink: '#FFFFFF', light: true },
  { id: 'plaja', accent: '#D9704A', colors: ['#F6926A', '#F7B98A', '#1E6A86'], glows: [['#FFE0B0', 0.5, 0.45], ['#2A8AA8', 0.5, 1]], decoration: 'sun', ink: '#FFFFFF', light: false },
  { id: 'aurora', accent: '#23A882', colors: ['#0F1A2A', '#14243A', '#1A1238'], glows: [['#3FE0B0', 0.25, 0.3], ['#8E5CFF', 0.8, 0.65]], decoration: 'aurora', ink: '#9FF5DA', light: false },
  { id: 'corporate', accent: '#3A6BD6', colors: ['#14244A', '#1E3A6E', '#0E1A36'], glows: [['#3FD6C6', 0.8, 0.2], ['#3A6BFF', 0.2, 0.8]], decoration: 'grid', ink: '#9EC7FF', light: false },
  { id: 'absolvire', accent: '#C99A28', colors: ['#18223C', '#24304E', '#121A2E'], glows: [['#F2C14E', 0.8, 0.2], ['#4A5A8A', 0.2, 0.85]], decoration: 'cap', ink: '#F2C14E', light: false },
  { id: 'cina', accent: '#B0303A', colors: ['#5A1420', '#8A2A2A', '#C2562E'], glows: [['#F2994A', 0.8, 0.85], ['#B0303A', 0.2, 0.2]], decoration: 'plate', ink: '#FFD2B0', light: false },
  { id: 'minimal', accent: '#8C7A5E', colors: ['#F4EFE6', '#EFE8DC', '#F7F3EC'], glows: [['#FFFFFF', 0.3, 0.3], ['#E2D6C2', 0.8, 0.8]], decoration: 'line', ink: '#CDBFA6', light: true },
];

const BY_ID = new Map(COVER_THEMES.map((theme) => [theme.id, theme]));

export function getCoverTheme(id: string | null | undefined): CoverTheme | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/** The theme that fits the category, shown first and marked "suggested". */
export function suggestedCoverTheme(type: EventTypeId | null, template: SpontaneousTemplate | null): string {
  if (type === 'spontaneous') {
    return template === 'karaoke' ? 'karaoke' : template === 'tasting' ? 'elegant' : 'petrecere';
  }
  switch (type) {
    case 'wedding':
      return 'nunta';
    case 'baptism':
      return 'botez';
    case 'birthday':
      return 'aniversare';
    case 'cause':
      return 'gradina';
    case 'corporate':
      return 'corporate';
    case 'memorial':
      return 'minimal';
    case 'venue':
      return 'local';
    default:
      return 'petrecere';
  }
}

/** Plans that unlock "Alege cu AI" on the theme step. */
export const AI_THEME_PLANS: readonly string[] = ['complet', 'premium', 'agentie'];

function mixHex(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  let out = '#';
  for (let i = 0; i < 3; i += 1) {
    out += Math.round(channel(a, i) * (1 - t) + channel(b, i) * t)
      .toString(16)
      .padStart(2, '0');
  }
  return out;
}

/**
 * The same theme, pulled toward the app theme (Hârtie, Șampanie, …): its base
 * colors get a share of the app's accent, so every cover sits in tune with
 * the rest of the app while keeping its own look.
 */
export function harmonizeCoverTheme(theme: CoverTheme, tokens: ThemeTokens): CoverTheme {
  const toward = tokens.accentFill;
  const amount = 0.22;
  return {
    ...theme,
    colors: [mixHex(theme.colors[0], toward, amount), mixHex(theme.colors[1], toward, amount), mixHex(theme.colors[2], toward, amount)],
  };
}
