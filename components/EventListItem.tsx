import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScaleTouchable } from '@/components/ScaleTouchable';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { Skeleton } from '@/components/Skeleton';
import { StoryTimeline, currentStage } from '@/components/StoryTimeline';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import { EVENT_COVERS } from '@/utils/eventCovers';
import { getEventType } from '@/utils/eventTypes';
import { countRsvps, daysUntilEvent, eventShortSubtitle } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { imageScrim, onImage, onImageMuted, pastCoverShade, themeRadius, typeface } from '@/utils/themeTokens';

/** On-band chips: white 90% with dark text, same in both modes (text never sits on the gradient itself). */
const CHIP_BG = 'rgba(255,255,255,0.9)';
const CHIP_TEXT = '#2B2740';

/**
 * Event card for Home: the type's cover photo on top (type icon, plan chip,
 * countdown, then name and date · place over a dark fade), then the
 * four-stage story timeline and the RSVP counts.
 */
export function EventListItem({
  event,
  onPress,
  planLabel,
  onPressChoosePlan,
  coOrganizerLabel = null,
  onLongPress,
}: {
  event: AppEvent;
  onPress: () => void;
  /** Resolved plan_features.display_name for event.planTier, or null when
   * planTier itself is null (no plan chosen yet) — see app/index.tsx, the
   * only caller, for how this is looked up. */
  planLabel: string | null;
  onPressChoosePlan: () => void;
  /** "Naș", "Mireasă"…: shown instead of the plan chip (the plan is the owner's call). */
  coOrganizerLabel?: string | null;
  /** Organizers: long press opens edit / delete (see app/index.tsx). */
  onLongPress?: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const type = getEventType(event.type);
  const counts = countRsvps(event.guests);
  const days = daysUntilEvent(event.date);
  const stage = currentStage(days);
  // An event that already happened: grey band, whole card dimmed.
  const past = days !== null && days < 0;

  const countdown =
    days === null
      ? null
      : days === 0
        ? t('home.countdownToday')
        : days < 0
          ? t('home.countdownPast')
          : t('home.countdown', { count: days });

  return (
    <ScaleTouchable
      scaleTo={0.98}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${counts.confirmed} ${t('home.confirmedCount')}`}
      style={[
        styles.card,
        past && styles.past,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <ImageBackground source={EVENT_COVERS[type.id]} style={styles.cover} resizeMode="cover">
        <LinearGradient colors={imageScrim} locations={[0.25, 1]} style={StyleSheet.absoluteFill} />
        {past ? <View style={[StyleSheet.absoluteFill, { backgroundColor: pastCoverShade }]} /> : null}

        <View style={styles.coverTop}>
          <View style={styles.iconChip}>
            <EventTypeIcon type={type.id} size={18} color={CHIP_TEXT} />
          </View>
          <View style={styles.flex} />
          {coOrganizerLabel !== null ? (
            <View style={styles.chip}>
              <Feather name="users" size={13} color={CHIP_TEXT} />
              <Text style={styles.chipText}>{coOrganizerLabel}</Text>
            </View>
          ) : planLabel !== null ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{planLabel}</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={onPressChoosePlan}
              activeOpacity={0.75}
              style={styles.chip}
              accessibilityRole="button"
              accessibilityLabel={t('common.choosePlan')}
              hitSlop={8}
            >
              <Feather name="plus" size={13} color={CHIP_TEXT} />
              <Text style={styles.chipText}>{t('common.choosePlan')}</Text>
            </TouchableOpacity>
          )}
          {countdown !== null ? (
            <View style={[styles.chip, styles.countdown]}>
              <Text style={[styles.chipText, styles.countdownText]}>{countdown}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={2}>
            {event.name}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={14} color={onImageMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {eventShortSubtitle(event)}
            </Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.body}>
        <StoryTimeline stage={stage} type={event.type} />

        <View style={[styles.divider, { backgroundColor: tokens.border }]} />

        <View style={styles.footerRow}>
          <View style={styles.count}>
            <View style={[styles.countDot, { backgroundColor: tokens.statusConfirmed }]} />
            <Text style={[styles.countText, { color: tokens.textPrimary }]}>
              <Text style={styles.countNumber}>{counts.confirmed}</Text> {t('home.confirmedCount')}
            </Text>
          </View>
          <View style={styles.count}>
            <View style={[styles.countDot, { backgroundColor: tokens.accentGold }]} />
            <Text style={[styles.countText, { color: tokens.textPrimary }]}>
              <Text style={styles.countNumber}>{counts.pending}</Text> {t('home.pendingCount')}
            </Text>
          </View>
          <View style={styles.flex} />
          <View style={styles.open}>
            <Text style={[styles.openText, { color: tokens.accentText }]}>{t('home.open')}</Text>
            <Feather name="chevron-right" size={16} color={tokens.accentText} />
          </View>
        </View>
      </View>
    </ScaleTouchable>
  );
}

/** Same band/body proportions as the real card above, so nothing shifts when data lands. */
export function EventListItemSkeleton() {
  const { tokens } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Skeleton height={150} width="100%" radius={0} />
      <View style={styles.body}>
        <Skeleton height={36} width="100%" radius={8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  past: {
    opacity: 0.4,
  },
  card: {
    borderRadius: themeRadius.xxl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: {
    height: 150,
    padding: 12,
    justifyContent: 'space-between',
  },
  coverTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CHIP_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    backgroundColor: CHIP_BG,
  },
  chipText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
    color: CHIP_TEXT,
  },
  countdown: {
    paddingHorizontal: 11,
  },
  countdownText: {
    fontFamily: typeface.bodyBold,
    fontSize: 13,
  },
  titleBlock: {
    gap: 4,
  },
  name: {
    fontFamily: typeface.title,
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.3,
    color: onImage,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    flex: 1,
    fontFamily: typeface.bodyMedium,
    fontSize: 13,
    color: onImageMuted,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: spacing.md,
  },
  divider: {
    height: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countText: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
  countNumber: {
    fontFamily: typeface.bodyBold,
  },
  flex: {
    flex: 1,
  },
  open: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 28,
  },
  openText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 13,
  },
});
