import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * Thin rounded bars, one per step: a solid color through the current step
 * (the accent, or `color`, e.g. the chosen event type's), border tone after.
 */
export function SegmentedProgress({
  total,
  current,
  color,
}: {
  total: number;
  current: number;
  color?: string;
}) {
  const { tokens } = useTheme();
  const fill = color ?? tokens.accentFill;

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[styles.segment, { backgroundColor: index <= current ? fill : tokens.border }]}
        />
      ))}
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
