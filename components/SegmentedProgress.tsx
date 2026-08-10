import { StyleSheet, View } from 'react-native';

import { brand } from '@/utils/guestTheme';

/** Thin rounded bars, one per step: purple through the current step, lavender after. */
export function SegmentedProgress({ total, current }: { total: number; current: number }) {
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.segment, index <= current && styles.filled]} />
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
    backgroundColor: brand.lavender,
  },
  filled: {
    backgroundColor: brand.purple,
  },
});
