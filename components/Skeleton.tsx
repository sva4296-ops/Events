import { useEffect } from 'react';
import type { DimensionValue, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/**
 * Light gray-lavender rather than a flat gray, so the pulse reads on both the
 * cream page background and the white/navy cards it sits inside — see
 * utils/theme.ts's `colors.border`/`primarySoft` and utils/guestTheme.ts's
 * `guest.purpleSoft`, which this splits the difference between.
 */
const SKELETON_TONE = '#E7E1F5';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: ViewStyle;
}

/**
 * The one shimmering-rectangle primitive every screen-specific skeleton below
 * composes from. A pulsing opacity (rather than a gradient sweep) is the
 * simplest thing that reads as "loading" with the animation tooling already
 * in the project (reanimated, already a dependency for gestures/swipe rows).
 */
// No default `height`: several callers (e.g. the Album grid tile, which is
// square via `aspectRatio`) rely on the style prop deriving height instead —
// an explicit default here would win over aspectRatio and flatten them.
export function Skeleton({ width = '100%', height, radius = 8, style }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius, backgroundColor: SKELETON_TONE },
        animatedStyle,
        style,
      ]}
    />
  );
}
