import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { EventTypeMeta } from '@/types/event';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

interface TypeTileProps {
  type: EventTypeMeta;
  selected: boolean;
  onPress: () => void;
}

export function TypeTile({ type, selected, onPress }: TypeTileProps) {
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={type.label}
      style={[
        styles.tile,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: selected ? type.accent : tokens.surfaceBorder ?? 'transparent',
        },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <LinearGradient colors={type.gradient} style={styles.gradient}>
        <Text style={styles.emoji}>{type.emoji}</Text>
      </LinearGradient>
      <Text style={[styles.label, { color: selected ? type.accent : tokens.textPrimary }]}>
        {type.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: themeRadius.lg,
    borderWidth: 2,
  },
  gradient: {
    width: 52,
    height: 52,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
