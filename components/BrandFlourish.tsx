import { useId } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { FLOURISH_PATH, FLOURISH_VIEWBOX, MARK_STOPS } from '@/utils/brandMark';

interface BrandFlourishProps {
  width?: number;
  height?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The gold→pink→purple wavy line (the original thread, before the heart),
 * reused as a small decorative corner accent. Shares MARK_STOPS with BrandMark
 * and BrandSplash so the colors can never drift apart. Deliberately stretched to a
 * flatter, wider aspect than the logo's own (184×136) so it reads as a
 * sliver-like accent rather than a shrunk copy of the mark.
 */
export function BrandFlourish({ width = 60, height = 26, opacity = 0.55, style }: BrandFlourishProps) {
  const gradientId = `brandFlourish-${useId()}`;

  return (
    <Svg width={width} height={height} viewBox={FLOURISH_VIEWBOX} style={style} opacity={opacity}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          {MARK_STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Path
        d={FLOURISH_PATH}
        stroke={`url(#${gradientId})`}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
