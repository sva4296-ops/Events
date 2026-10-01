import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { haptics } from '@/utils/haptics';

/** Warm Story 2.0 switch row: label left, 50×30 pill switch right. */
export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (next: boolean) => void }) {
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => {
        haptics.tap();
        onChange(!value);
      }}
      activeOpacity={0.8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <Text style={[styles.label, { color: tokens.textPrimary }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: value ? tokens.accentFill : tokens.border }]}>
        <View style={[styles.knob, value ? styles.knobOn : styles.knobOff]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  track: {
    width: 50,
    height: 30,
    borderRadius: 15,
  },
  knob: {
    position: 'absolute',
    top: 3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  knobOn: {
    right: 3,
  },
  knobOff: {
    left: 3,
  },
});
