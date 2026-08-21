import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * A small filled-checkmark-vs-empty-outline indicator — the at-a-glance
 * "is this set or not" signal, reusing the same success color the
 * "Confirmat" RSVP pill already uses (`tokens.statusConfirmed`), not a new
 * ad-hoc color. Decorative only (the row it sits in already carries the
 * accessible label via its own status text), so no accessibility props here.
 */
export function StatusDot({ complete }: { complete: boolean }) {
  const { tokens } = useTheme();

  if (complete) {
    return (
      <View style={[styles.dot, { backgroundColor: tokens.statusConfirmedSoft }]}>
        <Feather name="check" size={11} color={tokens.statusConfirmed} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: tokens.surfaceBorder ?? tokens.textSecondary,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
