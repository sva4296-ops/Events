import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { fundGradient, guest, gRadius } from '@/utils/guestTheme';

/** Gold-to-purple fill, clamped so an over-funded event can't overflow the track. */
export function ProgressBar({ current, target }: { current: number; target: number }) {
  const ratio = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: target, now: current }}
    >
      <LinearGradient
        colors={fundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.fill, { width: `${ratio * 100}%` }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: gRadius.pill,
    backgroundColor: guest.creamDeep,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: gRadius.pill,
  },
});
