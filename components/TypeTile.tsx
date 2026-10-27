import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { CoverArt } from '@/components/CoverArt';
import { EventTypeIcon } from '@/components/EventTypeIcon';
import { ScaleTouchable } from '@/components/ScaleTouchable';
import { useTheme } from '@/hooks/useTheme';
import type { EventTypeMeta } from '@/types/event';
import type { EventTypeId } from '@/types/event';
import { getCoverTheme } from '@/utils/coverThemes';
import { haptics } from '@/utils/haptics';
import { themeRadius, typeface } from '@/utils/themeTokens';

/**
 * The warmest of each type's five themes, so the first screen of the wizard
 * reads warm and inviting (no cold blue grid for corporate, no grey memorial).
 */
const CARD_THEME: Record<EventTypeId, string> = {
  wedding: 'nunta',
  baptism: 'ingeras',
  birthday: 'aniversare',
  cause: 'inima',
  corporate: 'gala',
  memorial: 'amurg',
  venue: 'terasa',
  spontaneous: 'karaoke',
  other: 'festival',
};

interface TypeTileProps {
  type: EventTypeMeta;
  selected: boolean;
  onPress: () => void;
}

/**
 * A picture card for the type step, two per row: the type's signature cover
 * theme with its name over it, one line below.
 * Reads as a catalogue of moods rather than a grid of icon boxes.
 */
export function TypeTile({ type, selected, onPress }: TypeTileProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const label = t(`eventTypes.${type.id}.label`);
  const cover = getCoverTheme(CARD_THEME[type.id])!;
  const ink = cover.light ? '#2B2740' : '#FFFFFF';

  return (
    <ScaleTouchable
      scaleTo={0.97}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      activeOpacity={0.9}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={styles.tile}
    >
      <View style={[styles.frame, { borderColor: selected ? tokens.accentFill : 'transparent' }]}>
        <CoverArt theme={cover} style={styles.cover}>
          <View style={styles.coverInner}>
            <EventTypeIcon type={type.id} size={20} color={ink} strokeWidth={1.6} />
            <Text style={[styles.label, { color: ink, fontFamily: tokens.displayFont }]} numberOfLines={2}>
              {label}
            </Text>
          </View>
          {selected ? (
            <View style={[styles.check, { backgroundColor: tokens.accentFill }]}>
              <Feather name="check" size={14} color={tokens.onAccent} />
            </View>
          ) : null}
        </CoverArt>
      </View>
      <Text style={[styles.description, { color: tokens.textSecondary }]} numberOfLines={2}>
        {t(`eventTypes.${type.id}.description`)}
      </Text>
    </ScaleTouchable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    gap: 8,
  },
  frame: {
    borderWidth: 2,
    borderRadius: themeRadius.xl + 3,
    padding: 2,
  },
  cover: {
    aspectRatio: 1,
    borderRadius: themeRadius.xl,
  },
  coverInner: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 14,
  },
  label: {
    fontSize: 22,
    lineHeight: 26,
  },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    fontFamily: typeface.body,
    fontSize: 13,
    lineHeight: 17,
    paddingHorizontal: 4,
  },
});
