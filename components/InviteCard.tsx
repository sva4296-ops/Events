import Feather from '@expo/vector-icons/Feather';
import { EventCover } from '@/components/EventCover';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { useTheme } from '@/hooks/useTheme';
import type { EventDraft, SpontaneousTemplate } from '@/types/event';
import { getEventType } from '@/utils/eventTypes';
import { formatEventDate } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';

/** On-band chips: white 90% with dark text in both modes — text never sits on the gradient itself. */
const CHIP_BG = 'rgba(255,255,255,0.9)';
const CHIP_TEXT = '#2B2740';
const RADIUS = 28;

/**
 * Warm Story 2.0 invitation card: the type's band on top (type chip + icon),
 * then the name in Playfair, the welcome message as a quote, and date/place.
 * Accepts both a wizard draft and a saved event — the shapes overlap.
 * `coverPhoto` swaps the gradient band for the type's cover photo.
 */
export type InviteCardEvent = Pick<EventDraft, 'type' | 'name' | 'date' | 'location' | 'welcomeMessage'> & {
  /** Spontaneous events: the template names the chip, the time follows the date. */
  template?: SpontaneousTemplate | null;
  startTime?: string | null;
  /** utils/coverThemes.ts id: drawn cover instead of the band/photo. */
  coverTheme?: string | null;
};

export function InviteCard({ event }: { event: InviteCardEvent; /** Kept for callers; every card now draws EventCover. */ coverPhoto?: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const type = getEventType(event.type);
  const name = event.name.trim();
  const location = event.location.trim();
  const message = event.welcomeMessage.trim();
  const time = event.startTime?.trim() ?? '';
  const chipLabel =
    type.id === 'spontaneous' && event.template != null
      ? t(`spontaneous.templates.${event.template}.name`)
      : t(`eventTypes.${type.id}.label`);

  const coverContent = (
    <>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{chipLabel}</Text>
      </View>
      <View style={styles.emojiCircle}>
        <EventTypeIcon type={type.id} size={36} color={CHIP_TEXT} strokeWidth={1.6} />
      </View>
    </>
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <EventCover type={type.id} coverTheme={event.coverTheme} style={styles.cover}>
        {coverContent}
      </EventCover>

      <View style={styles.body}>
        <Text style={[styles.name, { color: tokens.textPrimary }]}>
          {name.length > 0 ? name : t('createWizard.previewNameFallback')}
        </Text>
        {message.length > 0 ? (
          <Text style={[styles.quote, { color: tokens.textPrimary }]}>„{message}”</Text>
        ) : null}

        <View style={[styles.divider, { backgroundColor: tokens.border }]} />

        <View style={styles.metaRow}>
          <Feather name="calendar" size={16} color={tokens.textSecondary} />
          <Text style={[styles.meta, { color: tokens.textSecondary }]}>{formatEventDate(event.date)}
            {time.length > 0 ? ` · ${time}` : ''}
          </Text>
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
    overflow: 'hidden',
  },
  cover: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    // Rounded to match the card so no square corner peeks out past the clip
    // (a known RN overflow rendering gap).
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
    overflow: 'hidden',
  },
  coverImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
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
