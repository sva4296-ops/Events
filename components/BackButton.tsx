import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';

import { colors, radius } from '@/utils/theme';

/**
 * The white-circle, dark-chevron back button — extracted from Header so
 * screens without a full Header (a hero card instead of a title) can still
 * use the exact same control, not a re-drawn one.
 */
export function BackButton({ style }: { style?: ViewStyle }) {
  return (
    <TouchableOpacity
      style={[styles.control, style]}
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      activeOpacity={0.7}
    >
      <Feather name="chevron-left" size={22} color={colors.text} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  control: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
