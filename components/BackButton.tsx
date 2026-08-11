import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * The white-circle, dark-chevron back button — extracted from Header so
 * screens without a full Header (a hero card instead of a title) can still
 * use the exact same control, not a re-drawn one.
 */
export function BackButton({ style }: { style?: ViewStyle }) {
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.control, { backgroundColor: tokens.surfaceElevated }, style]}
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      activeOpacity={0.7}
    >
      <Feather name="chevron-left" size={22} color={tokens.textPrimary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  control: {
    width: 40,
    height: 40,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
