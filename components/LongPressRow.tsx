import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { showActionSheet } from '@/components/ActionSheet';
import { haptics } from '@/utils/haptics';

export interface LongPressAction {
  label: string;
  tone: 'edit' | 'delete';
  onPress: () => void;
  /** Kept from the old swipe actions; the sheet picks its icon from `tone`. */
  icon?: string;
}

interface LongPressRowProps {
  children: ReactNode;
  actions: LongPressAction[];
  enabled?: boolean;
  /** Menu title, usually the row's name. */
  title?: string;
}

/**
 * The app's one pattern for editing or deleting something in a list: hold the
 * row (350ms, light haptic) to get Edit / Delete / Cancel. Same as moments and
 * Home's event cards. A plain tap still belongs to the row itself (e.g. open
 * it). Deleting confirms in the action itself (confirmDelete), not here.
 *
 * Native long-press recognizer, so it works around rows that are themselves
 * touchable: once it fires, the row's own touch is cancelled and no tap follows.
 */
export function LongPressRow({ children, actions, enabled = true, title }: LongPressRowProps) {
  if (!enabled || actions.length === 0) {
    return <>{children}</>;
  }

  const openMenu = () => {
    haptics.press();
    showActionSheet({
      title,
      actions: actions.map((action) => ({ label: action.label, tone: action.tone, onPress: action.onPress })),
    });
  };

  const longPress = Gesture.LongPress().minDuration(350).runOnJS(true).onStart(openMenu);

  // A plain View as the detector's direct child, so any row (a custom component
  // included) has a native view to attach to.
  return (
    <GestureDetector gesture={longPress}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}
