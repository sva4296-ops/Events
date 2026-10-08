import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { brandGradient } from '@/utils/themeTokens';

/**
 * Thin rounded bars, one per step: a gradient through the current step
 * (the brand's, or `colors`, e.g. the chosen event type's), border tone after.
 */
export function SegmentedProgress({
  total,
  current,
  colors = brandGradient,
}: {
  total: number;
  current: number;
  colors?: readonly [string, string, ...string[]];
}) {
  const { tokens } = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, index) =>
        index <= current ? (
          <LinearGradient
            key={index}
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.segment}
          />
        ) : (
          <View key={index} style={[styles.segment, { backgroundColor: tokens.border }]} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 999,
  },
});
