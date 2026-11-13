import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

/** A glow is drawn this small and scaled up: the gradient is soft enough, and the bitmap stays tiny. */
const GLOW_DRAW_SIZE = 48;

function Glow({
  id,
  color,
  opacity,
  size,
  left,
  top,
}: {
  id: string;
  color: string;
  opacity: number;
  size: number;
  left: number;
  top: number;
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left: left - GLOW_DRAW_SIZE / 2,
        top: top - GLOW_DRAW_SIZE / 2,
        transform: [{ scale: size / GLOW_DRAW_SIZE }],
      }}
    >
      <Svg width={GLOW_DRAW_SIZE} height={GLOW_DRAW_SIZE}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={GLOW_DRAW_SIZE} height={GLOW_DRAW_SIZE} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * Two soft glows behind the content (no dust specks anymore). Completely static: it
 * used to drift, which kept the screen redrawing nonstop (battery). No big
 * bitmaps either (about 75 MB per screen when it drew them). It stays mounted
 * when the screen loses focus: unmounting it there made the backdrop go flat
 * for a moment before and after every navigation, and it's cheap enough to keep.
 */
export function AmbientBackground() {
  const { tokens } = useTheme();
  const { width, height } = useWindowDimensions();
  const dark = tokens.mode === 'dark';
  const strength = dark ? 1 : 0.6;
  const reach = Math.max(width, height);
  // The website's themes: violet and rose, softer. The others: their accent and gold.
  const site = tokens.coverBase !== undefined;
  // On Site light: its warm rose and gold, which sit on the cream; violet reads cold there.
  const firstColor = site && !dark ? tokens.accentPink : (tokens.coverBase ?? tokens.accentFill);
  const secondColor = site && dark ? tokens.accentPink : tokens.accentGold;

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} pointerEvents="none">
      <Glow
        id="ambient-accent"
        color={firstColor}
        opacity={site ? (dark ? 0.14 : 0.2) : 0.3 * strength}
        size={reach * 1.1}
        left={width * 0.2}
        top={height * 0.2}
      />
      <Glow
        id="ambient-gold"
        color={secondColor}
        opacity={site ? (dark ? 0.09 : 0.22) : 0.11 * strength}
        size={reach * 0.84}
        left={width * 0.82}
        top={height * 0.75}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
});
