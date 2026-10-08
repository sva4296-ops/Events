import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { useTheme } from '@/hooks/useTheme';
import type { EventDraft } from '@/types/event';
import { getEventType } from '@/utils/eventTypes';
import { formatEventDate } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { bandGradientLocations, themeRadius, typography } from '@/utils/themeTokens';

/** On-band chips: white 90% with dark text in both modes — text never sits on the gradient itself. */
const CHIP_BG = 'rgba(255,255,255,0.9)';
const CHIP_TEXT = '#2B2740';
const RADIUS = 28;

/**
 * Warm Story 2.0 invitation card: the type's band on top (type chip + icon),
 * then the name in Playfair, the welcome message as a quote, and date/place.
 * Accepts both a wizard draft and a saved event — the shapes overlap.
 */
export function InviteCard({ event }: { event: EventDraft }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const type = getEventType(event.type);
  const name = event.name.trim();
  const location = event.location.trim();
  const message = event.welcomeMessage.trim();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <LinearGradient
        colors={type.band}
        locations={bandGradientLocations}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cover}
      >
        <View style={styles.chip}>
          <Text style={styles.chipText}>{t(`eventTypes.${type.id}.label`)}</Text>
        </View>
        <View style={styles.emojiCircle}>
          <EventTypeIcon type={type.id} size={36} color={CHIP_TEXT} strokeWidth={1.6} />
        </View>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={[styles.name, { color: tokens.textPrimary }]}>
          {name.length > 0 ? name : 'Your event name'}
        </Text>
        {message.length > 0 ? (
          <Text style={[styles.quote, { color: tokens.textPrimary }]}>„{message}”</Text>
        ) : null}

        <View style={[styles.divider, { backgroundColor: tokens.border }]} />

        <View style={styles.metaRow}>
          <Feather name="calendar" size={16} color={tokens.textSecondary} />
          <Text style={[styles.meta, { color: tokens.textSecondary }]}>{formatEventDate(event.date)}</Text>
        </View>
        {location.length > 0 ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={16} color={tokens.textSecondary} />
            <Text style={[styles.meta, { color: tokens.textSecondary }]}>{location}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    // Rounded to match the card so the border never shows a square corner
    // peeking out past the clip (a known RN overflow/border rendering gap).
    borderTopLeftRadius: RADIUS - 1,
    borderTopRightRadius: RADIUS - 1,
  },
  chip: {
    position: 'absolute',
    top: 14,
    left: 14,
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    backgroundColor: CHIP_BG,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CHIP_TEXT,
  },
  emojiCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: CHIP_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingTop: 22,
    paddingHorizontal: 22,
    paddingBottom: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.display,
    fontSize: 32,
    lineHeight: 38,
    textAlign: 'center',
  },
  quote: {
    ...typography.quote,
    textAlign: 'center',
    marginTop: 6,
  },
  divider: {
    height: 1,
    alignSelf: 'stretch',
    marginTop: 10,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: {
    fontSize: 14,
    textAlign: 'center',
    flexShrink: 1,
  },
});
