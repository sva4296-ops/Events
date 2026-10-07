import type { EventTypeId } from '@/types/event';
import { EVENT_TYPE_COLORS } from '@/utils/eventCovers';
import type { ThemeTokens } from '@/utils/themeTokens';

/**
 * Accent tokens in the event type's color (from its cover art), so buttons,
 * switches, the + button and the active tab match the cover behind them.
 * Cards and text stay neutral. Applied by EventAccentProvider (hooks/useTheme.tsx).
 */
type AccentTokens = Pick<ThemeTokens, 'accentPrimary' | 'accentFill' | 'onAccent' | 'accentTint' | 'accentText'>;

const DARK_INK = '#1E1A30';
const WHITE = '#FFFFFF';

function mix(a: string, b: string, t: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  let out = '#';
  for (let i = 0; i < 3; i += 1) {
    const value = Math.round(channel(a, i) * (1 - t) + channel(b, i) * t);
    out += value.toString(16).padStart(2, '0').toUpperCase();
  }
  return out;
}

function luminance(hex: string): number {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(0) + 0.7152 * lin(1) + 0.0722 * lin(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Text on the fill: whichever of white / dark ink reads better. */
function onFill(fill: string): string {
  return contrast(fill, WHITE) >= contrast(fill, DARK_INK) ? WHITE : DARK_INK;
}

export function eventAccentTokens(type: EventTypeId, base: ThemeTokens): AccentTokens & { tabBar: ThemeTokens['tabBar'] } {
  const fill = EVENT_TYPE_COLORS[type].fill;
  const dark = base.mode === 'dark';
  const accentText = dark ? mix(fill, WHITE, 0.35) : mix(fill, '#000000', 0.35);
  return {
    accentPrimary: fill,
    accentFill: fill,
    onAccent: onFill(fill),
    accentTint: dark ? mix(fill, base.background[0], 0.75) : mix(fill, WHITE, 0.85),
    accentText,
    tabBar: { ...base.tabBar, active: accentText },
  };
}
