import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { useTheme } from '@/hooks/useTheme';
import type { EventTypeMeta } from '@/types/event';
import { bandGradientLocations, themeRadius } from '@/utils/themeTokens';

interface TypeTileProps {
  type: EventTypeMeta;
  selected: boolean;
  onPress: () => void;
}

/** Warm Story 2.0 type tile: two per row, type band icon, name + one-line description, check when selected. */
export function TypeTile({ type, selected, onPress }: TypeTileProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const label = t(`eventTypes.${type.id}.label`);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={[
        styles.tile,
        {
          backgroundColor: tokens.surface,
          borderColor: selected ? tokens.accentPrimary : tokens.border,
          borderWidth: selected ? 2 : 1.5,
        },
      ]}
    >
      <LinearGradient
        colors={type.band}
        locations={bandGradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.icon}
      >
        <EventTypeIcon type={type.id} size={24} color={type.bandInk} />
      </LinearGradient>

      <View style={styles.text}>
        <Text style={[styles.label, { color: tokens.textPrimary }]}>{label}</Text>
        <Text style={[styles.description, { color: tokens.textSecondary }]} numberOfLines={2}>
          {t(`eventTypes.${type.id}.description`)}
        </Text>
      </View>

      {selected ? (
        <View style={[styles.check, { backgroundColor: tokens.accentFill }]}>
          <Feather name="check" size={15} color={tokens.onAccent} />
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 132,
    padding: 16,
    borderRadius: themeRadius.xl,
    justifyContent: 'space-between',
    gap: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: themeRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    gap: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
