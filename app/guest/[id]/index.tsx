import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandFlourish } from '@/components/BrandFlourish';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { MomentCard, MomentCardSkeleton } from '@/components/guest/MomentCard';
import { StoryTimeline, currentStage } from '@/components/StoryTimeline';
import { SwipeableRow } from '@/components/SwipeableRow';
import { confirmDelete } from '@/utils/confirm';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import type { EventTypeId } from '@/types/event';
import { daysUntilEvent, eventStartTime } from '@/utils/format';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';
import { staggerIn } from '@/utils/motion';
import { accentButtonShadow, themeRadius, typography } from '@/utils/themeTokens';

/**
 * Live countdown (days · hours · minutes) to the event's start: its date at
 * the earliest time in the Program, or midnight without one. Once the start
 * passes it's the type's day-of headline, then "the story continues" after
 * the day. Ticks every 15s (minute resolution, no seconds).
 */
function CountdownCard({ date, type, scheduleTimes }: { date: string; type: EventTypeId; scheduleTimes: string[] }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [now, setNow] = useState(() => Date.now());
  const days = daysUntilEvent(date);
  const start = eventStartTime(date, scheduleTimes);
  const remaining = start !== null ? start.getTime() - now : 0;
  const counting = start !== null && remaining > 0;

  useEffect(() => {
    if (!counting) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [counting]);

  // Round up to the minute so "0 min" never shows while time is still left.
  const totalMinutes = Math.ceil(remaining / 60_000);
  const units = [
    { key: 'days', value: Math.floor(totalMinutes / 1440) },
    { key: 'hours', value: Math.floor((totalMinutes % 1440) / 60) },
    { key: 'minutes', value: totalMinutes % 60 },
  ] as const;
  const untilLabel = t(`eventTypes.${type}.countdownUntil`);

  const headline =
    days === null || counting
      ? null
      : days >= 0
        ? t(`eventTypes.${type}.countdownToday`)
        : t('acasa.countdownPast');

  return (
    <View style={[styles.countdown, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      {counting ? (
        <View
          style={styles.countdownBody}
          accessible
          accessibilityLabel={`${units.map((unit) => t(`acasa.unit_${unit.key}`, { count: unit.value })).join(', ')} ${untilLabel}`}
        >
          <View style={styles.units}>
            {units.map((unit) => (
              <View key={unit.key} style={[styles.unit, { backgroundColor: tokens.surface2 }]}>
                <Text style={[styles.unitValue, { color: tokens.textPrimary }]}>{unit.value}</Text>
                <Text style={[styles.unitLabel, { color: tokens.textSecondary }]}>
                  {t(`acasa.unitShort_${unit.key}`, { count: unit.value })}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[styles.countdownSub, { color: tokens.textSecondary }]}>{untilLabel}</Text>
        </View>
      ) : null}
      {headline !== null ? (
        <Text style={[styles.countdownTitle, { color: tokens.textPrimary }]}>{headline}</Text>
      ) : null}
      <StoryTimeline stage={currentStage(days)} type={type} />
    </View>
  );
}

export default function AcasaScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { content, toggleReaction, hasReacted, reactionCount, deleteMoment } = useEventContent(id);

  const owner = isOwner(event);
  // Distance from the true screen bottom up to the tab bar's top edge — the
  // FAB and this screen's own extra bottom padding both build on it.
  const tabBarClearance = tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height;

  if (content === null) {
    return (
      <GuestScreen transparent>
        {event !== undefined ? <CountdownCard
            date={event.date}
            type={event.type}
            scheduleTimes={[]}
          /> : null}
        <MomentCardSkeleton />
        <MomentCardSkeleton />
      </GuestScreen>
    );
  }

  return (
    <View style={styles.wrap}>
      <GuestScreen
        contentStyle={owner ? { paddingBottom: tabBarClearance + gSpace.xxl + 56 } : undefined}
        transparent
      >
        {event !== undefined ? <CountdownCard
            date={event.date}
            type={event.type}
            scheduleTimes={content.schedule.map((item) => item.time)}
          /> : null}

        {content.moments.length === 0 ? (
          <EmptyState message={owner ? t('acasa.emptyOwner') : t('acasa.emptyGuest')} />
        ) : null}

        {content.moments.map((moment, index) => (
          <Animated.View key={moment.id} entering={staggerIn(index)}>
            <SwipeableRow
              enabled={owner}
              actions={[
                {
                  label: t('common.delete'),
                  icon: 'trash-2',
                  tone: 'delete',
                  onPress: () =>
                    confirmDelete(
                      t('acasa.deleteMomentTitle'),
                      t('acasa.deleteMomentBody', { title: moment.title }),
                      () => deleteMoment(moment.id),
                    ),
                },
              ]}
            >
              <MomentCard
                moment={moment}
                authorName={event?.name ?? ''}
                authorType={event?.type ?? null}
                loveCount={reactionCount(moment.id, 'love')}
                celebrateCount={reactionCount(moment.id, 'celebrate')}
                lovedByMe={hasReacted(moment.id, 'love')}
                celebratedByMe={hasReacted(moment.id, 'celebrate')}
                onReact={(reaction) => toggleReaction(moment.id, reaction)}
              />
            </SwipeableRow>
          </Animated.View>
        ))}

        {content.fund !== null ? (
          <View
            style={[
              styles.promo,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
              tokens.surfaceElevatedShadow ?? undefined,
            ]}
          >
            <BrandFlourish width={52} height={22} opacity={0.4} style={styles.promoFlourish} />
            <Text style={[styles.promoTitle, { color: tokens.textPrimary }]}>{content.fund.title}</Text>
            <Text style={[styles.promoBody, { color: tokens.textSecondary }]}>{t('acasa.fundPromoBody')}</Text>
            <Button label={t('acasa.viewFund')} variant="tonal" onPress={() => router.push(`/guest/${id}/fond`)} />
          </View>
        ) : null}
      </GuestScreen>

      {owner ? (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: tokens.accentFill, bottom: tabBarClearance + gSpace.lg },
            tokens.mode === 'light' ? accentButtonShadow : undefined,
          ]}
          onPress={() => router.push(`/post-moment/${id}`)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('acasa.postMoment')}
        >
          <Feather name="plus" size={26} color={tokens.onAccent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  countdown: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  countdownBody: {
    gap: 10,
  },
  units: {
    flexDirection: 'row',
    gap: 8,
  },
  unit: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 12,
    gap: 2,
  },
  unitValue: {
    ...typography.title1,
    fontVariant: ['tabular-nums'],
  },
  unitLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  countdownTitle: {
    ...typography.title2,
  },
  countdownSub: {
    fontSize: 13,
    textAlign: 'center',
  },
  promo: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  promoFlourish: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  promoTitle: {
    ...typography.title2,
  },
  promoBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
