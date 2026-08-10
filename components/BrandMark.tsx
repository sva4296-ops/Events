import { useId } from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { MARK_PATH, MARK_RATIO, MARK_STOPS, MARK_VIEWBOX } from '@/utils/brandMark';

/** The gold→pink→purple curve, drawn statically. The splash animates its own copy. */
export function BrandMark({ width = 34, strokeWidth = 12 }: { width?: number; strokeWidth?: number }) {
  // Unique per instance so multiple marks on one screen can't share a gradient id.
  const gradientId = `brandMark-${useId()}`;

  return (
    <Svg width={width} height={width / MARK_RATIO} viewBox={MARK_VIEWBOX}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
          {MARK_STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Path
        d={MARK_PATH}
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
