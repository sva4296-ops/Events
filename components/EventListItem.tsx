import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ScaleTouchable } from '@/components/ScaleTouchable';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { Skeleton } from '@/components/Skeleton';
import { StoryTimeline, currentStage } from '@/components/StoryTimeline';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import { getEventType } from '@/utils/eventTypes';
import { countRsvps, daysUntilEvent, eventShortSubtitle } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { bandGradientLocations, themeRadius, typography } from '@/utils/themeTokens';

/** On-band chips: white 90% with dark text, same in both modes (text never sits on the gradient itself). */
const CHIP_BG = 'rgba(255,255,255,0.9)';
const CHIP_TEXT = '#2B2740';

/**
 * Warm Story 2.0 event card for Home: type band on top (type icon, plan chip,
 * countdown), then name, date · place, the four-stage story timeline and the
 * RSVP counts.
 */
export function EventListItem({
  event,
  onPress,
  planLabel,
  onPressChoosePlan,
}: {
  event: AppEvent;
  onPress: () => void;
  /** Resolved plan_features.display_name for event.planTier, or null when
   * planTier itself is null (no plan chosen yet) — see app/index.tsx, the
   * only caller, for how this is looked up. */
  planLabel: string | null;
  onPressChoosePlan: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const type = getEventType(event.type);
  const counts = countRsvps(event.guests);
  const days = daysUntilEvent(event.date);
  const stage = currentStage(days);

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
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${counts.confirmed} ${t('home.confirmedCount')}`}
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
        style={styles.band}
      >
        <View style={styles.emojiCircle}>
          <EventTypeIcon type={type.id} size={26} color={CHIP_TEXT} />
        </View>

        {planLabel !== null ? (
          <View style={[styles.chip, styles.planChip]}>
            <Text style={styles.chipText}>{planLabel}</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onPressChoosePlan}
            activeOpacity={0.75}
            style={[styles.chip, styles.planChip]}
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
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.titleBlock}>
          <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={2}>
            {event.name}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="calendar" size={15} color={tokens.textSecondary} />
            <Text style={[styles.meta, { color: tokens.textSecondary }]} numberOfLines={1}>
              {eventShortSubtitle(event)}
            </Text>
          </View>
        </View>

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
      <Skeleton height={104} width="100%" radius={0} />
      <View style={styles.body}>
        <Skeleton height={22} width="65%" radius={6} />
        <Skeleton height={13} width="50%" radius={4} />
        <Skeleton height={36} width="100%" radius={8} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.xxl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  band: {
    height: 104,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  emojiCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: CHIP_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    backgroundColor: CHIP_BG,
  },
  planChip: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: CHIP_TEXT,
  },
  countdown: {
    height: 28,
    paddingHorizontal: 12,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    padding: 18,
    paddingBottom: 16,
    gap: spacing.lg,
  },
  titleBlock: {
    gap: 6,
  },
  name: {
    ...typography.title2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    flex: 1,
    fontSize: 13,
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
    fontSize: 13,
  },
  countNumber: {
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
  open: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 32,
  },
  openText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
