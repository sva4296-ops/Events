import type { Ref } from 'react';
import { TouchableOpacity, type GestureResponderEvent, type TouchableOpacityProps, type View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const SPRING = { damping: 18, stiffness: 320, mass: 0.6 };

interface ScaleTouchableProps extends TouchableOpacityProps {
  /** Scale while held. 0.97 for buttons, 0.98 for large cards. */
  scaleTo?: number;
  /** Forwarded to the touchable (React 19 ref-as-prop), e.g. for the tour spotlight. */
  ref?: Ref<View>;
}

/**
 * Drop-in TouchableOpacity that also shrinks slightly while pressed and
 * springs back. Only animates `transform`, on the UI thread, so it costs
 * nothing extra on low-end phones.
 */
export function ScaleTouchable({ scaleTo = 0.97, onPressIn, onPressOut, style, disabled, ...rest }: ScaleTouchableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const handlePressIn = (event: GestureResponderEvent) => {
    if (!disabled) scale.set(withSpring(scaleTo, SPRING));
    onPressIn?.(event);
  };
  const handlePressOut = (event: GestureResponderEvent) => {
    scale.set(withSpring(1, SPRING));
    onPressOut?.(event);
  };

  return (
    <AnimatedTouchable
      {...rest}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
    />
  );
}
