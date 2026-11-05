import { type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import { FLOURISH_PATH, FLOURISH_VIEWBOX } from '@/utils/brandMark';

interface BrandFlourishProps {
  width?: number;
  height?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * The wavy line (the original thread, before the heart), reused as a small
 * decorative corner accent, in the theme's accent like BrandMark. Deliberately stretched to a
 * flatter, wider aspect than the logo's own (184×136) so it reads as a
 * sliver-like accent rather than a shrunk copy of the mark.
 */
export function BrandFlourish({ width = 60, height = 26, opacity = 0.55, style }: BrandFlourishProps) {
  const { tokens } = useTheme();

  return (
    <Svg width={width} height={height} viewBox={FLOURISH_VIEWBOX} style={style} opacity={opacity}>
      <Path
        d={FLOURISH_PATH}
        stroke={tokens.accentFill}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
