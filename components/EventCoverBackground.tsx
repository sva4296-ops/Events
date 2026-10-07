import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { EventTypeId } from '@/types/event';
import { EVENT_COVERS } from '@/utils/eventCovers';

/**
 * The event type's cover art, full screen, under a veil of the page
 * background so headers, forms and cards stay readable. Used behind the event
 * tabs (app/guest/[id]/_layout.tsx) and, via `coverType` on Screen /
 * GuestScreen, on every screen opened from an event, so they all match.
 */
export function EventCoverBackground({ type }: { type: EventTypeId }) {
  const { tokens } = useTheme();
  const base = tokens.background[0];

  return (
    <View style={styles.cover} pointerEvents="none">
      <Image source={EVENT_COVERS[type]} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient
        colors={[withAlpha(base, 0.6), withAlpha(base, 0.3), withAlpha(base, 0.55), withAlpha(base, 0.85)]}
        locations={[0, 0.25, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** `#RRGGBB` + alpha as `#RRGGBBAA`. */
function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  // Full screen; overflow hidden because iOS draws a "cover" image past its own
  // bounds (a portrait photo spilled below a fixed-height box).
  cover: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});
