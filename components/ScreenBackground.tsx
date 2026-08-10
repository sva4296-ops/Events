import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { brand } from '@/utils/guestTheme';

/**
 * Shared decorative backdrop for Auth and Home. Non-interactive and behind all
 * content; opacities are kept low so cards, inputs and body text stay legible.
 */
export function ScreenBackground() {
  const { width, height } = useWindowDimensions();

  return (
    <View style={styles.layer} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="bgWash" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#FFF8F1" />
            <Stop offset="1" stopColor="#FBEAE0" />
          </LinearGradient>
          <LinearGradient id="bgLine" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={brand.gold} />
            <Stop offset="0.5" stopColor={brand.pink} />
            <Stop offset="1" stopColor={brand.purple} />
          </LinearGradient>
        </Defs>

        <Path d={`M0 0 H${width} V${height} H0 Z`} fill="url(#bgWash)" />

        <Circle cx={width * 0.86} cy={height * 0.1} r={width * 0.42} fill={brand.gold} opacity={0.11} />
        <Circle cx={width * 0.1} cy={height * 0.44} r={width * 0.38} fill={brand.purple} opacity={0.1} />
        <Circle cx={width * 0.78} cy={height * 0.88} r={width * 0.45} fill={brand.pink} opacity={0.1} />

        {/* Edge-to-edge flowing lines. */}
        <Path
          d={`M${-width * 0.05} ${height * 0.3} C ${width * 0.3} ${height * 0.16}, ${width * 0.62} ${height * 0.42}, ${width * 1.05} ${height * 0.24}`}
          stroke="url(#bgLine)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.3}
        />
        <Path
          d={`M${-width * 0.05} ${height * 0.74} C ${width * 0.34} ${height * 0.88}, ${width * 0.6} ${height * 0.6}, ${width * 1.05} ${height * 0.8}`}
          stroke="url(#bgLine)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          opacity={0.22}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
