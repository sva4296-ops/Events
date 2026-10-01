import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptics. Costs nothing to render; a device without a
 * haptic engine (or a simulator) just ignores the call.
 */
export const haptics = {
  /** Selection change: tabs, toggles, picking a tile. */
  tap: () => {
    Haptics.selectionAsync().catch(() => undefined);
  },
  /** Light physical bump for the main call to action. */
  press: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  /** A completed, positive action: RSVP confirmed, invite sent. */
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
};
