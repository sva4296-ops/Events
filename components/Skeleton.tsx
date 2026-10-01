import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';

// Dark mode keeps the original lavender-gray tone unchanged (it already read
// fine against navy/dark cards). Light mode reuses `tokens.textSecondary`
// instead — the original tone was too close to white/cream to read clearly
// on light cards.
const DARK_SKELETON_TONE = '#E7E1F5';
// Same mid-point as the old 0.5 → 1 opacity pulse, now static under the sheen.
const BASE_OPACITY = 0.6;
const SHIMMER_MS = 1300;

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}

/**
 * The one loading-placeholder primitive every screen-specific skeleton
 * composes from: a muted block with a soft highlight sweeping left to right
 * (translateX only, UI thread). The sheen is the card color at ~60% alpha,
 * so it reads as a light streak in light mode and a dark one over the pale
 * dark-mode tone. With "reduce motion" on, the block is static.
 */
// No default `height`: several callers (e.g. the Album grid tile, which is
// square via `aspectRatio`) rely on the style prop deriving height instead —
// an explicit default here would win over aspectRatio and flatten them.
export function Skeleton({ width = '100%', height, radius = 8, style }: SkeletonProps) {
  const { tokens } = useTheme();
  const reduceMotion = useReducedMotion();
  const tone = tokens.mode === 'dark' ? DARK_SKELETON_TONE : tokens.textSecondary;
  const sheen = `${tokens.surface}99`;
  const boxWidth = useSharedValue(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(withRepeat(withTiming(1, { duration: SHIMMER_MS, easing: Easing.inOut(Easing.quad) }), -1, false));
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const onLayout = (event: LayoutChangeEvent) => {
    boxWidth.set(event.nativeEvent.layout.width);
  };

  const sheenStyle = useAnimatedStyle(() => {
    const w = boxWidth.get();
    return {
      opacity: w > 0 ? 1 : 0,
      transform: [{ translateX: -w + progress.get() * 2 * w }],
    };
  });

  return (
    <View
      onLayout={onLayout}
      style={[styles.box, { width, height, borderRadius: radius }, style]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tone, opacity: BASE_OPACITY }]} />
      {reduceMotion ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, sheenStyle]}>
          <LinearGradient
            colors={['transparent', sheen, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    overflow: 'hidden',
  },
});
