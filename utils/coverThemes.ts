import type { EventTypeId, SpontaneousTemplate } from '@/types/event';
import type { ThemeTokens } from '@/utils/themeTokens';

/**
 * Cover themes an organizer picks in the create wizard (app/create/invite.tsx).
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
  | 'line'
  | 'arch'
  | 'petals'
  | 'stars'
  | 'waves'
  | 'candle'
  | 'dots'
  | 'glass'
  | 'drop'
  | 'table'
  | 'rise'
  | 'wedrings'
  | 'flags';

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

/** Compact form for the per-type sets below: glows sit top-right and bottom-left. */
function t(
  id: string,
  accent: string,
  colors: readonly [string, string, string],
  glows: readonly [string, string],
  decoration: CoverDecoration,
  ink: string,
  light: boolean,
): CoverTheme {
  return { id, accent, colors, glows: [[glows[0], 0.8, 0.25], [glows[1], 0.2, 0.85]], decoration, ink, light };
}

export const COVER_THEMES: readonly CoverTheme[] = [
  { id: 'petrecere', accent: '#8E5CFF', colors: ['#3A1C5C', '#5B2A86', '#2A1446'], glows: [['#E8579A', 0.15, 0.2], ['#7B5CFF', 0.85, 0.55]], decoration: 'disco', ink: '#C9B8FF', light: false },
  { id: 'aniversare', accent: '#D9603F', colors: ['#7A2E3A', '#C2563F', '#4A1E3A'], glows: [['#FFB070', 0.75, 0.3], ['#E8579A', 0.2, 0.75]], decoration: 'confetti', ink: '#FFE2C2', light: false },
  { id: 'local', accent: '#6A5CE0', colors: ['#2A2266', '#4B3A9E', '#1C1850'], glows: [['#E8579A', 0.2, 0.25], ['#B79CFF', 0.85, 0.2]], decoration: 'glass', ink: '#FFFFFF', light: false },
  { id: 'karaoke', accent: '#C2318E', colors: ['#3B0F45', '#7A1F6B', '#24103A'], glows: [['#FF4FA3', 0.15, 0.3], ['#8E5CFF', 0.85, 0.75]], decoration: 'bars', ink: '#F4D6FF', light: false },
  { id: 'disco', accent: '#7B5CFF', colors: ['#1E1446', '#4A2A86', '#14102E'], glows: [['#FF6FB5', 0.2, 0.75], ['#9C8CFF', 0.75, 0.25]], decoration: 'disco', ink: '#FFFFFF', light: false },
  { id: 'neon', accent: '#1FA8B6', colors: ['#0B0F1A', '#121826', '#0A0C14'], glows: [['#2FD3E0', 0.8, 0.2], ['#B05CFF', 0.2, 0.8]], decoration: 'neon', ink: '#6FF1FF', light: false },
  { id: 'revelion', accent: '#C9922E', colors: ['#0E1430', '#1A2350', '#0A0F24'], glows: [['#F2B544', 0.5, 0.95], ['#5B6BFF', 0.2, 0.2]], decoration: 'fireworks', ink: '#FFD27A', light: false },
  { id: 'craciun', accent: '#C8382E', colors: ['#0F3B2A', '#1D5A3C', '#5A1A1E'], glows: [['#E0453A', 0.85, 0.15], ['#3FB57E', 0.2, 0.7]], decoration: 'tree', ink: '#FFE9C9', light: false },
  { id: 'halloween', accent: '#D9701A', colors: ['#1A1020', '#2B1638', '#120A16'], glows: [['#FF8A2A', 0.7, 0.35], ['#6A2A9E', 0.2, 0.85]], decoration: 'moon', ink: '#FFC46B', light: false },
  { id: 'nunta', accent: '#C2788A', colors: ['#F6D9D4', '#E9C4C8', '#F3E3DA'], glows: [['#FFFFFF', 0.25, 0.25], ['#E2A6B4', 0.8, 0.8]], decoration: 'wedrings', ink: '#FFFFFF', light: true },
  { id: 'elegant', accent: '#B08A42', colors: ['#141210', '#1E1A14', '#0E0C0A'], glows: [['#C9A55C', 0.55, 0.45], ['#5A4422', 0.2, 0.9]], decoration: 'gold', ink: '#D9B972', light: false },
  { id: 'botez', accent: '#5E8CCB', colors: ['#D8E8FA', '#E3DDF7', '#F4E6F1'], glows: [['#FFFFFF', 0.3, 0.3], ['#B9D6FF', 0.8, 0.7]], decoration: 'drop', ink: '#FFFFFF', light: true },
  { id: 'copii', accent: '#D9709A', colors: ['#FFF0B8', '#FFE1E8', '#E8F5D6'], glows: [['#FFFFFF', 0.3, 0.3], ['#FFC0D4', 0.8, 0.8]], decoration: 'balloons', ink: '#FFFFFF', light: true },
  { id: 'gradina', accent: '#43965E', colors: ['#E4F7C9', '#C9F0D2', '#F2F9DE'], glows: [['#FFFFFF', 0.3, 0.3], ['#A6E3B8', 0.85, 0.75]], decoration: 'leaf', ink: '#FFFFFF', light: true },
  { id: 'plaja', accent: '#D9704A', colors: ['#F6926A', '#F7B98A', '#1E6A86'], glows: [['#FFE0B0', 0.5, 0.45], ['#2A8AA8', 0.5, 1]], decoration: 'sun', ink: '#FFFFFF', light: false },
  { id: 'aurora', accent: '#23A882', colors: ['#0F1A2A', '#14243A', '#1A1238'], glows: [['#3FE0B0', 0.25, 0.3], ['#8E5CFF', 0.8, 0.65]], decoration: 'aurora', ink: '#9FF5DA', light: false },
  { id: 'corporate', accent: '#3A6BD6', colors: ['#14244A', '#1E3A6E', '#0E1A36'], glows: [['#3FD6C6', 0.8, 0.2], ['#3A6BFF', 0.2, 0.8]], decoration: 'grid', ink: '#9EC7FF', light: false },
  { id: 'absolvire', accent: '#C99A28', colors: ['#18223C', '#24304E', '#121A2E'], glows: [['#F2C14E', 0.8, 0.2], ['#4A5A8A', 0.2, 0.85]], decoration: 'cap', ink: '#F2C14E', light: false },
  { id: 'cina', accent: '#B0303A', colors: ['#5A1420', '#8A2A2A', '#C2562E'], glows: [['#F2994A', 0.8, 0.85], ['#B0303A', 0.2, 0.2]], decoration: 'plate', ink: '#FFD2B0', light: false },
  { id: 'minimal', accent: '#8C7A5E', colors: ['#F4EFE6', '#EFE8DC', '#F7F3EC'], glows: [['#FFFFFF', 0.3, 0.3], ['#E2D6C2', 0.8, 0.8]], decoration: 'line', ink: '#CDBFA6', light: true },
  // Corporate only: a conference, a gala, a team day out.
  { id: 'conferinta', accent: '#2F7FA8', colors: ['#0F2236', '#16344F', '#0B1A2A'], glows: [['#4FB3D9', 0.8, 0.25], ['#2E5C8A', 0.2, 0.85]], decoration: 'rings', ink: '#8FD0EA', light: false },
  { id: 'gala', accent: '#B8954E', colors: ['#121212', '#1C1A16', '#0C0C0C'], glows: [['#C9A55C', 0.75, 0.3], ['#3A3020', 0.2, 0.9]], decoration: 'sparkles', ink: '#E2C47E', light: false },
  { id: 'teambuilding', accent: '#3E8E5E', colors: ['#DDF0D8', '#C6E6CF', '#EAF5DC'], glows: [['#FFFFFF', 0.3, 0.3], ['#9ED3A8', 0.8, 0.8]], decoration: 'leaf', ink: '#FFFFFF', light: true },
  // The per-type sets (THEMES_BY_TYPE).
  t('trandafiri', '#B5476A', ['#5A1E33', '#8C2F4F', '#3E1424'], ['#E87A9C', '#7A2240'], 'petals', '#F6C2D2', false),
  t('arcada', '#8C7AAE', ['#EDE6F3', '#DCD2EA', '#F5F0F8'], ['#FFFFFF', '#BFAEDC'], 'arch', '#FFFFFF', true),
  t('aurit', '#B8913F', ['#2A2218', '#3A2E1C', '#1C1610'], ['#E0B860', '#5A4422'], 'sparkles', '#E8C77A', false),
  t('salvie', '#6E8B6A', ['#DCE5D3', '#C9D7BE', '#E8EEE0'], ['#FFFFFF', '#9DB592'], 'leaf', '#FFFFFF', true),
  t('ingeras', '#C2A15A', ['#FBF6EA', '#F3EAD3', '#FFFDF6'], ['#FFFFFF', '#EAD7A6'], 'stars', '#D8BE7A', true),
  t('bleu', '#5E8CCB', ['#DCEBFA', '#C6DCF4', '#EAF3FC'], ['#FFFFFF', '#9EC2EE'], 'dots', '#FFFFFF', true),
  t('rozpudrat', '#C77E92', ['#F8E3E8', '#EFCDD6', '#FBEEF1'], ['#FFFFFF', '#E3A9B8'], 'balloons', '#FFFFFF', true),
  t('nori', '#7EA6D1', ['#E3EEF8', '#D1E2F2', '#F1F6FB'], ['#FFFFFF', '#B3CDE8'], 'waves', '#FFFFFF', true),
  t('retro', '#D97B2E', ['#F2B33D', '#E0782E', '#B4452A'], ['#FFE08A', '#8C2E1E'], 'waves', '#FFF1C9', false),
  t('sclipici', '#B85CD9', ['#2B1640', '#4A1F66', '#1C0E2C'], ['#E07AFF', '#5B2AA0'], 'sparkles', '#F6D6FF', false),
  t('jubileu', '#C9A23E', ['#1E1A12', '#2E2618', '#14110C'], ['#E8C65C', '#6A5428'], 'gold', '#EBD08A', false),
  t('speranta', '#E08A3C', ['#2A2040', '#5A3A5A', '#E08A3C'], ['#FFC36B', '#6A4A8A'], 'rise', '#FFE3B0', false),
  t('apa', '#2F8FC6', ['#D6EEF9', '#BCE2F5', '#E8F6FC'], ['#FFFFFF', '#86C9EA'], 'waves', '#FFFFFF', true),
  t('inima', '#D0563E', ['#F6D3C4', '#EDB39C', '#F8E3D8'], ['#FFFFFF', '#E07A5F'], 'hearts', '#FFFFFF', true),
  t('comunitate', '#D9822E', ['#2A1E14', '#4A3220', '#1C140C'], ['#F2A04A', '#7A4A22'], 'dots', '#F7C98A', false),
  t('lansare', '#E0563A', ['#14141C', '#24242E', '#0C0C12'], ['#FF6A3D', '#3A3A5A'], 'stars', '#FFB49C', false),
  t('lumanare', '#C99A4B', ['#1A1612', '#26201A', '#100E0C'], ['#E0A84A', '#3A2E20'], 'candle', '#F2CB86', false),
  t('crini', '#A7B0A0', ['#F4F4EF', '#E8E9E1', '#FAFAF6'], ['#FFFFFF', '#D3D8CA'], 'petals', '#B9C2B0', true),
  t('amurg', '#9A7AA8', ['#3A2E4A', '#5A4560', '#2A2236'], ['#C99AB8', '#4A3A6A'], 'rise', '#E8D2E6', false),
  t('stele', '#8A96C9', ['#161A2A', '#222842', '#0E111C'], ['#6E7AB8', '#2A3058'], 'stars', '#D6DCF2', false),
  t('jazz', '#C98A3E', ['#120E1A', '#1E1628', '#0A0810'], ['#E0A04A', '#4A2E6A'], 'bars', '#F2C98A', false),
  t('lounge', '#6A5CE0', ['#14102A', '#221A44', '#0C0A1C'], ['#8E7CFF', '#3A2A80'], 'rings', '#C8BEFF', false),
  t('terasa', '#7E7A36', ['#E6E0C2', '#D2CBA0', '#EEEAD6'], ['#FFFFFF', '#B8B070'], 'table', '#8A8240', true),
  t('degustare', '#9E3A56', ['#F2E2E6', '#E6CCD3', '#F8EEF1'], ['#FFFFFF', '#CC8FA2'], 'glass', '#B56A80', true),
  t('festival', '#E0A03E', ['#2A1A40', '#5A2A6A', '#E0A03E'], ['#FFD06B', '#B04AE0'], 'flags', '#FFE8B0', false),
  t('muzica', '#7A5CE0', ['#120E24', '#201844', '#0A0818'], ['#9E7CFF', '#E0457A'], 'bars', '#D8CCFF', false),
  t('primavara', '#E07A9E', ['#FBE8EE', '#EEF6E0', '#FCF2F5'], ['#FFFFFF', '#F2B4C8'], 'petals', '#FFFFFF', true),
];

const BY_ID = new Map(COVER_THEMES.map((theme) => [theme.id, theme]));

export function getCoverTheme(id: string | null | undefined): CoverTheme | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

/**
 * Five themes per event type, none shared between types, each drawn with an
 * illustration that fits its name and the occasion (no tree on a charity).
 * The first one is the suggested. Themes not listed here stay defined only so
 * events created with them earlier still render.
 */
const THEMES_BY_TYPE: Record<EventTypeId, readonly string[]> = {
  wedding: ['nunta', 'trandafiri', 'arcada', 'aurit', 'salvie'],
  baptism: ['botez', 'ingeras', 'bleu', 'rozpudrat', 'nori'],
  birthday: ['aniversare', 'copii', 'sclipici', 'jubileu', 'retro'],
  cause: ['gradina', 'inima', 'speranta', 'apa', 'comunitate'],
  corporate: ['corporate', 'conferinta', 'gala', 'teambuilding', 'lansare'],
  memorial: ['minimal', 'lumanare', 'crini', 'amurg', 'stele'],
  venue: ['local', 'cina', 'jazz', 'lounge', 'terasa'],
  spontaneous: ['petrecere', 'karaoke', 'neon', 'degustare', 'aurora'],
  other: ['festival', 'revelion', 'craciun', 'muzica', 'primavara'],
};

export function coverThemesFor(type: EventTypeId | null): CoverTheme[] {
  return THEMES_BY_TYPE[type ?? 'other'].map((id) => BY_ID.get(id)).filter((theme): theme is CoverTheme => theme !== undefined);
}

/** The theme that fits the category, shown first and marked "suggested". */
export function suggestedCoverTheme(type: EventTypeId | null, template: SpontaneousTemplate | null): string {
  if (type === 'spontaneous') {
    switch (template) {
      case 'karaoke':
        return 'karaoke';
      case 'tasting':
      case 'limited':
        return 'degustare';
      case 'trip':
        return 'aurora';
      case 'outing':
        return 'neon';
      default:
        return 'petrecere';
    }
  }
  return THEMES_BY_TYPE[type ?? 'other'][0]!;
}


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
