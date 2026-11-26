import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { avatarPalette, avatarInk } from '@/utils/themeTokens';

/** Small stable hash (FNV-1a) so the same seed always draws the same face. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Placeholder avatar for people without a photo: a friendly face on a tilted
 * tile, colors and pose picked from the seed (the user id), so it's random
 * across people but always the same for one person. Drawn locally, no service.
 */
export function GeneratedAvatar({ seed, size }: { seed: string; size: number }) {
  const h = hash(seed);
  const n = avatarPalette.length;
  const bg = avatarPalette[h % n] ?? avatarPalette[0];
  const tile = avatarPalette[(h % n + 1 + ((h >>> 4) % (n - 1))) % n] ?? avatarPalette[1];
  const rotate = ((h >>> 8) % 50) - 25;
  const dx = ((h >>> 12) % 9) - 4;
  const dy = ((h >>> 16) % 7) - 2;
  const openMouth = ((h >>> 20) & 1) === 1;
  const eyeGap = 4 + ((h >>> 21) % 3);

  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" accessible={false}>
      <Rect width={36} height={36} rx={18} fill={bg} />
      <G transform={`translate(${dx} ${dy}) rotate(${rotate} 18 18)`}>
        <Rect x={6} y={6} width={24} height={24} rx={8} fill={tile} />
      </G>
      <G transform={`translate(${dx / 2} ${dy / 2})`}>
        <Circle cx={18 - eyeGap} cy={16} r={1.6} fill={avatarInk} />
        <Circle cx={18 + eyeGap} cy={16} r={1.6} fill={avatarInk} />
        {openMouth ? (
          <Path d="M14 21 Q18 25.5 22 21 Z" fill={avatarInk} />
        ) : (
          <Path d="M14.5 21 Q18 24 21.5 21" stroke={avatarInk} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        )}
      </G>
    </Svg>
  );
}
