import type { ReactNode } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface GrowFromLeftProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

/**
 * Reveals its content by sliding it in from the left, so a bar looks like it
 * fills up. Must sit inside a parent with `overflow: 'hidden'` (a progress
 * track). Translate + opacity only: the bar's real width is laid out once,
 * then only its position animates. Hidden until measured, so there's no
 * full-width flash on the first frame.
 */
export function GrowFromLeft({ children, style, duration = 700 }: GrowFromLeftProps) {
  const reduceMotion = useReducedMotion();
  const width = useSharedValue(0);
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  const onLayout = (event: LayoutChangeEvent) => {
    const measured = event.nativeEvent.layout.width;
    if (measured === width.get()) return;
    width.set(measured);
    if (!reduceMotion) {
      progress.set(0);
      progress.set(withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: width.get() > 0 ? 1 : 0,
    transform: [{ translateX: -(1 - progress.get()) * width.get() }],
  }));

  return (
    <Animated.View style={[style, animatedStyle]} onLayout={onLayout}>
      {children}
    </Animated.View>
  );
}
