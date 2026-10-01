import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { GrowFromLeft } from '@/components/GrowFromLeft';

import { useTheme } from '@/hooks/useTheme';
import { gRadius } from '@/utils/guestTheme';
import { brandGradient } from '@/utils/themeTokens';

/** Brand gradient fill (gold → pink → purple), clamped so an over-funded event can't overflow the track. */
export function ProgressBar({ current, target }: { current: number; target: number }) {
  const { tokens } = useTheme();
  const ratio = target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;

  return (
    <View
      style={[styles.track, { backgroundColor: tokens.surface2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: target, now: current }}
    >
      <GrowFromLeft style={[styles.fill, { width: `${ratio * 100}%` }]}>
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, styles.fill]}
        />
      </GrowFromLeft>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 12,
    borderRadius: gRadius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: gRadius.pill,
  },
});
