import { useId } from 'react';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import {
  MARK_DOT_RADIUS,
  MARK_END,
  MARK_PATH,
  MARK_RATIO,
  MARK_START,
  MARK_STOPS,
  MARK_STROKE_WIDTH,
  MARK_UNITS_WIDTH,
  MARK_VIEWBOX,
} from '@/utils/brandMark';

/** The story-thread heart logo, drawn statically. The splash animates its own copy. */
export function BrandMark({ width = 52 }: { width?: number }) {
  // Unique per instance so multiple marks on one screen can't share a gradient id.
  const gradientId = `brandMark-${useId()}`;

  return (
    <Svg width={width} height={width / MARK_RATIO} viewBox={MARK_VIEWBOX}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2={MARK_UNITS_WIDTH} y2="0" gradientUnits="userSpaceOnUse">
          {MARK_STOPS.map((stop) => (
            <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </LinearGradient>
      </Defs>
      <Path
        d={MARK_PATH}
        stroke={`url(#${gradientId})`}
        strokeWidth={MARK_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx={MARK_START.x} cy={MARK_START.y} r={MARK_DOT_RADIUS} fill={MARK_STOPS[0].color} />
      <Circle cx={MARK_END.x} cy={MARK_END.y} r={MARK_DOT_RADIUS} fill={MARK_STOPS[2].color} />
    </Svg>
  );
}
