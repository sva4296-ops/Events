import { useTranslation } from 'react-i18next';
import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { ScaleTouchable } from '@/components/ScaleTouchable';
import { Skeleton } from '@/components/Skeleton';
import { currentStage, stageDayKey } from '@/components/StoryTimeline';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import { EVENT_COVERS } from '@/utils/eventCovers';
import { countRsvps, daysUntilEvent, eventShortSubtitle } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { pastCoverShade, themeRadius, typeface } from '@/utils/themeTokens';

const STAGE_KEYS = ['onboarding.stageLaunch', 'onboarding.stageJourney', null, 'onboarding.stageRecap'] as const;

/** Big countdown number + unit ("5 / zile"), or "Azi". Hidden for past/undated events. */
function DaysBadge({ days, size }: { days: number | null; size: 'big' | 'small' }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  if (days === null || days < 0) return null;
  if (size === 'small') {
    return (
      <Text style={[styles.rowDays, { color: days <= 7 ? tokens.accentText : tokens.textSecondary }]}>
        {days === 0 ? t('home.dashboard.today') : `${days} ${t('home.dashboard.daysShort', { count: days })}`}
      </Text>
    );
  }
  return (
    <View style={styles.daysBig}>
      <Text style={[styles.daysNumber, { color: tokens.accentText, fontFamily: tokens.displayFont }]}>
        {days === 0 ? t('home.dashboard.today') : days}
      </Text>
      {days > 0 ? (
        <Text style={[styles.daysUnit, { color: tokens.textSecondary }]}>
          {t('home.dashboard.daysShort', { count: days })}
        </Text>
      ) : null}
    </View>
  );
}

/** "Următorul" card: cover, name + countdown, four-segment stage bar, one action. */
export function DashboardHero({
  event,
  onPress,
  onLongPress,
  onPressInvite,
}: {
  event: AppEvent;
  onPress: () => void;
  onLongPress?: () => void;
  onPressInvite: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const days = daysUntilEvent(event.date);
  const past = days !== null && days < 0;
  const stage = currentStage(days);
  const stageName = t(STAGE_KEYS[stage] ?? stageDayKey(event.type));
  const counts = countRsvps(event.guests);
  const noGuests = event.guests.length === 0;

  return (
    <ScaleTouchable
      scaleTo={0.98}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={event.name}
      style={[
        styles.hero,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      {/* ImageBackground, not a bare View + absolute Image: a style-less View gets
          flattened away and the image then fills the whole card. */}
      <ImageBackground source={EVENT_COVERS[event.type]} style={styles.cover} resizeMode="cover">
        {past ? <View style={[StyleSheet.absoluteFill, { backgroundColor: pastCoverShade }]} /> : null}
        <View style={[styles.nextLabel, { backgroundColor: tokens.surface }]}>
          <Text style={[styles.nextLabelText, { color: tokens.accentText }]}>{t('home.dashboard.next')}</Text>
        </View>
      </ImageBackground>

      <View style={styles.heroBody}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={[styles.heroName, { color: tokens.textPrimary, fontFamily: tokens.displayFont }]} numberOfLines={2}>
              {event.name}
            </Text>
            <Text style={[styles.meta, { color: tokens.textSecondary }]} numberOfLines={1}>
              {eventShortSubtitle(event)}
            </Text>
          </View>
          <DaysBadge days={days} size="big" />
        </View>

        <View style={styles.segments}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[styles.segment, { backgroundColor: index <= stage ? tokens.accentFill : tokens.border }]}
            />
          ))}
        </View>
        <Text style={[styles.stageText, { color: tokens.textSecondary }]}>
          {t('home.dashboard.stageOf', { stage: stage + 1, name: stageName })}
        </Text>

        {noGuests && !past ? (
          <Button label={t('home.dashboard.sendInvites')} onPress={onPressInvite} />
        ) : (
          <View style={[styles.countsRow, { borderColor: tokens.border }]}>
            <Text style={[styles.countText, { color: tokens.textPrimary }]}>
              <Text style={styles.countNumber}>{counts.confirmed}</Text> {t('home.confirmedCount')}
              {'   '}
              <Text style={styles.countNumber}>{counts.pending}</Text> {t('home.pendingCount')}
            </Text>
            <Text style={[styles.open, { color: tokens.accentText }]}>{t('home.open')} →</Text>
          </View>
        )}
      </View>
    </ScaleTouchable>
  );
}

/** Compact "Urmează" row: cover thumb, name, date · place, days left. */
export function DashboardRow({
  event,
  onPress,
  onLongPress,
  showDivider,
}: {
  event: AppEvent;
  onPress: () => void;
  onLongPress?: () => void;
  showDivider: boolean;
}) {
  const { tokens } = useTheme();
  const days = daysUntilEvent(event.date);
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={event.name}
      style={[styles.row, showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border }]}
    >
      <Image source={EVENT_COVERS[event.type]} style={[styles.thumb, days !== null && days < 0 && styles.pastThumb]} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: tokens.textPrimary, fontFamily: tokens.displayFont }]} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]} numberOfLines={1}>
          {eventShortSubtitle(event)}
        </Text>
      </View>
      <DaysBadge days={days} size="small" />
    </TouchableOpacity>
  );
}

export function DashboardHeroSkeleton() {
  const { tokens } = useTheme();
  return (
    <View style={[styles.hero, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Skeleton style={styles.cover} />
      <View style={styles.heroBody}>
        <Skeleton style={{ height: 26, width: '60%', borderRadius: 8 }} />
        <Skeleton style={{ height: 14, width: '45%', borderRadius: 6 }} />
        <Skeleton style={{ height: 46, borderRadius: themeRadius.md }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: themeRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cover: {
    height: 170,
  },
  nextLabel: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  nextLabelText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroBody: {
    padding: spacing.lg,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  titleText: {
    flex: 1,
    gap: 2,
  },
  heroName: {
    fontSize: 28,
    lineHeight: 34,
  },
  meta: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
  daysBig: {
    alignItems: 'center',
    minWidth: 44,
  },
  daysNumber: {
    fontSize: 38,
    lineHeight: 42,
  },
  daysUnit: {
    fontFamily: typeface.body,
    fontSize: 12,
  },
  segments: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  stageText: {
    fontFamily: typeface.body,
    fontSize: 12,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: themeRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  countText: {
    flexShrink: 1,
    fontFamily: typeface.body,
    fontSize: 13,
  },
  countNumber: {
    fontFamily: typeface.bodySemiBold,
  },
  open: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  pastThumb: {
    opacity: 0.5,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 18,
  },
  rowDays: {
    fontFamily: typeface.bodyMedium,
    fontSize: 13,
  },
});
