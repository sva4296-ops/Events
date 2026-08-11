import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/** Thin rounded bars, one per step: accent through the current step, muted after. */
export function SegmentedProgress({ total, current }: { total: number; current: number }) {
  const { tokens } = useTheme();

  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            { backgroundColor: index <= current ? tokens.accentPrimary : `${tokens.accentPrimary}33` },
          ]}
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
