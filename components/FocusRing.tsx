import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * Warm Story 2.0 focus halo: a 4px accentTint ring around a focused field.
 * Drawn as a transparent-by-default outer border with a -4 margin, so
 * toggling it never shifts the layout.
 */
export function FocusRing({
  active,
  radius = themeRadius.md,
  children,
  style,
}: {
  active: boolean;
  radius?: number;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.ring,
        { borderRadius: radius + RING, borderColor: active ? tokens.accentTint : 'transparent' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const RING = 4;

const styles = StyleSheet.create({
  ring: {
    borderWidth: RING,
    margin: -RING,
  },
});
