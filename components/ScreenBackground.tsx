import { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

/**
 * Shared decorative backdrop for Auth, Home, and the guest tabs. Non-interactive
 * and behind all content; opacities are kept low so cards, inputs and body text
 * stay legible. Theme-aware: light mode is the original warm cream wash, dark
 * mode is a deep warm navy-purple wash — never plain black, so dark mode still
 * reads as "a warm evening," not a code editor.
 *
 * Sized from its own rendered layout (`onLayout`), not `useWindowDimensions()` —
 * every prior usage was full-page anyway, so this is a no-op change there, but
 * it's what makes the wash size correctly to a narrower container too, as of
 * the web master-detail layout (EventsListPane's left pane, the guest event's
 * right pane) — `useWindowDimensions()` would have sized the SVG to the whole
 * browser window regardless of which of those it was actually placed inside.
 */
export function ScreenBackground() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { tokens } = useTheme();
  const dark = tokens.mode === 'dark';

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const { width, height } = size;
  const circleOpacity = dark ? 0.16 : 0.11;
  const lineOpacityStrong = dark ? 0.4 : 0.3;
  const lineOpacitySoft = dark ? 0.3 : 0.22;

  return (
    <View style={styles.layer} pointerEvents="none" onLayout={onLayout}>
      {width > 0 && height > 0 ? (
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="bgWash" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={tokens.background[0]} />
            <Stop offset="1" stopColor={tokens.background[1]} />
          </LinearGradient>
          <LinearGradient id="bgLine" x1="0" y1="1" x2="1" y2="0">
            <Stop offset="0" stopColor={tokens.accentGold} />
            <Stop offset="0.5" stopColor={tokens.accentPink} />
            <Stop offset="1" stopColor={tokens.accentPrimary} />
          </LinearGradient>
        </Defs>

        <Path d={`M0 0 H${width} V${height} H0 Z`} fill="url(#bgWash)" />

        <Circle cx={width * 0.86} cy={height * 0.1} r={width * 0.42} fill={tokens.accentGold} opacity={circleOpacity} />
        <Circle cx={width * 0.1} cy={height * 0.44} r={width * 0.38} fill={tokens.accentPrimary} opacity={circleOpacity * 0.9} />
        <Circle cx={width * 0.78} cy={height * 0.88} r={width * 0.45} fill={tokens.accentPink} opacity={circleOpacity * 0.9} />

        {/* Edge-to-edge flowing lines. */}
        <Path
          d={`M${-width * 0.05} ${height * 0.3} C ${width * 0.3} ${height * 0.16}, ${width * 0.62} ${height * 0.42}, ${width * 1.05} ${height * 0.24}`}
          stroke="url(#bgLine)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          opacity={lineOpacityStrong}
        />
        <Path
          d={`M${-width * 0.05} ${height * 0.74} C ${width * 0.34} ${height * 0.88}, ${width * 0.6} ${height * 0.6}, ${width * 1.05} ${height * 0.8}`}
          stroke="url(#bgLine)"
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          opacity={lineOpacitySoft}
        />
      </Svg>
      ) : null}
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
