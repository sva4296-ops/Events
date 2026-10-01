import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { gRadius } from '@/utils/guestTheme';

const SPRING = { damping: 14, stiffness: 260, mass: 0.6 };

interface TabBarIconProps {
  name: keyof typeof Feather.glyphMap;
  color: ColorValue;
  focused: boolean;
}

/**
 * Tab icon with the Warm Story accentTint pill. When a tab becomes active the
 * pill grows in and the icon does a short pop. Transform + opacity only.
 */
export function TabBarIcon({ name, color, focused }: TabBarIconProps) {
  const { tokens } = useTheme();
  const pill = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);

  useEffect(() => {
    pill.set(withTiming(focused ? 1 : 0, { duration: 200 }));
    if (focused) {
      pop.set(withSequence(withTiming(1.14, { duration: 110 }), withSpring(1, SPRING)));
    }
  }, [focused, pill, pop]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pill.get(),
    transform: [{ scaleX: 0.6 + pill.get() * 0.4 }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: tokens.accentTint }, pillStyle]} />
      <Animated.View style={iconStyle}>
        <Feather name={name} size={21} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 48,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: gRadius.pill,
  },
});
