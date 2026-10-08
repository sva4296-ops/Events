import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { LineIcon, type Shape } from '@/components/EventTypeIcon';
import { useTheme } from '@/hooks/useTheme';
import { gRadius } from '@/utils/guestTheme';

const SPRING = { damping: 14, stiffness: 260, mass: 0.6 };

/**
 * Event tab icons, in the same line style as the event-type and moment icons
 * (Lucide geometry, ISC, https://lucide.dev): house, clipboard-list, gift,
 * message-circle-heart, radio, images.
 */
export const TAB_ICONS = {
  home: [
    { type: 'path', d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' },
    { type: 'path', d: 'M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  ],
  plan: [
    { type: 'rect', x: 8, y: 2, width: 8, height: 4, rx: 1 },
    { type: 'path', d: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' },
    { type: 'path', d: 'M12 11h4' },
    { type: 'path', d: 'M12 16h4' },
    { type: 'path', d: 'M8 11h.01' },
    { type: 'path', d: 'M8 16h.01' },
  ],
  fund: [
    { type: 'rect', x: 3, y: 8, width: 18, height: 4, rx: 1 },
    { type: 'path', d: 'M12 8v13' },
    { type: 'path', d: 'M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7' },
    { type: 'path', d: 'M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5' },
  ],
  chat: [
    { type: 'path', d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z' },
    { type: 'path', d: 'M15.8 9.2a2.5 2.5 0 0 0-3.5 0l-.3.4-.35-.3a2.42 2.42 0 1 0-3.2 3.6l3.6 3.5 3.6-3.5c1.2-1.2 1.1-2.7.2-3.7' },
  ],
  live: [
    { type: 'circle', cx: 12, cy: 12, r: 2 },
    { type: 'path', d: 'M4.9 19.1C1 15.2 1 8.8 4.9 4.9' },
    { type: 'path', d: 'M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5' },
    { type: 'path', d: 'M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5' },
    { type: 'path', d: 'M19.1 4.9C23 8.8 23 15.1 19.1 19' },
  ],
  album: [
    { type: 'path', d: 'M18 22H4a2 2 0 0 1-2-2V6' },
    { type: 'path', d: 'm22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18' },
    { type: 'circle', cx: 12, cy: 8, r: 2 },
    { type: 'rect', x: 6, y: 2, width: 16, height: 16, rx: 2 },
  ],
} as const satisfies Record<string, readonly Shape[]>;

export type TabIconId = keyof typeof TAB_ICONS;

interface TabBarIconProps {
  name: TabIconId;
  color: ColorValue;
  focused: boolean;
  /** Small dot on the icon, e.g. unread chat messages. */
  badge?: boolean;
}

/**
 * Tab icon with the Warm Story accentTint pill. When a tab becomes active the
 * pill grows in and the icon does a short pop. Transform + opacity only.
 */
export function TabBarIcon({ name, color, focused, badge = false }: TabBarIconProps) {
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
        <LineIcon shapes={TAB_ICONS[name]} size={22} color={String(color)} strokeWidth={focused ? 2 : 1.8} />
      </Animated.View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: tokens.accentFill, borderColor: tokens.surface }]} />
      ) : null}
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
  badge: {
    position: 'absolute',
    top: 0,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
});
