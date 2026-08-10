import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import type { EventTypeMeta } from '@/types/event';
import { colors, radius, shadow, spacing } from '@/utils/theme';

interface TypeTileProps {
  type: EventTypeMeta;
  selected: boolean;
  onPress: () => void;
}

export function TypeTile({ type, selected, onPress }: TypeTileProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={type.label}
      style={[styles.tile, selected && { borderColor: type.accent }]}
    >
      <LinearGradient colors={type.gradient} style={styles.gradient}>
        <Text style={styles.emoji}>{type.emoji}</Text>
      </LinearGradient>
      <Text style={[styles.label, selected && { color: type.accent }]}>{type.label}</Text>
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
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow,
  },
  gradient: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
