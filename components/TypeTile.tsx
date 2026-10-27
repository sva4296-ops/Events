import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { ScaleTouchable } from '@/components/ScaleTouchable';
import { useTheme } from '@/hooks/useTheme';
import type { EventTypeMeta } from '@/types/event';
import { haptics } from '@/utils/haptics';
import { typeface } from '@/utils/themeTokens';

interface TypeTileProps {
  type: EventTypeMeta;
  selected: boolean;
  onPress: () => void;
}

/**
 * One row of the type list: the name in the theme's display font, a one-line
 * description, a thin icon on the right, hairline dividers. A radio dot marks
 * the pick. Deliberately not a card grid with icon boxes (read as generic).
 */
export function TypeTile({ type, selected, onPress, first = false }: TypeTileProps & { first?: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const label = t(`eventTypes.${type.id}.label`);

  return (
    <ScaleTouchable
      scaleTo={0.98}
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={label}
      style={[styles.row, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border }]}
    >
      <View style={[styles.radio, { borderColor: selected ? tokens.accentFill : tokens.border }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: tokens.accentFill }]} /> : null}
      </View>

      <View style={styles.text}>
        <Text
          style={[styles.label, { color: selected ? tokens.accentText : tokens.textPrimary, fontFamily: tokens.displayFont }]}
        >
          {label}
        </Text>
        <Text style={[styles.description, { color: tokens.textSecondary }]} numberOfLines={1}>
          {t(`eventTypes.${type.id}.description`)}
        </Text>
      </View>

      <EventTypeIcon type={type.id} size={22} color={selected ? tokens.accentText : tokens.textMuted} strokeWidth={1.4} />
    </ScaleTouchable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 22,
    lineHeight: 28,
  },
  description: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
});
