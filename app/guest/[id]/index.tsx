import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showActionSheet, showDialog } from '@/components/ActionSheet';
import { BrandFlourish } from '@/components/BrandFlourish';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { EventCountdown, EventHero } from '@/components/guest/EventHero';
import { openGettingStarted } from '@/components/tour/GettingStartedSheet';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { StoryEntryCard } from '@/components/guest/StoryEntryCard';
import { MomentCard, MomentCardSkeleton } from '@/components/guest/MomentCard';
import { useTourTarget } from '@/components/tour/Tour';
import { SpontaneousHome } from '@/components/spontaneous/SpontaneousHome';
import { VenueTonight } from '@/components/venue/VenueTonight';
import { confirmDelete } from '@/utils/confirm';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { TOUR_TARGETS, useGettingStarted, type GettingStartedKey } from '@/hooks/useGettingStarted';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import type { ScheduleItem } from '@/types/guest';
import { isStoryReady } from '@/utils/eventStory';
import { FUND_ENABLED } from '@/utils/features';
import { daysUntilEvent, isEventPast } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';
import { staggerIn } from '@/utils/motion';
import { accentButtonShadow, themeRadius, typeface, typography } from '@/utils/themeTokens';

const STEP_ICONS: Record<GettingStartedKey, keyof typeof Feather.glyphMap> = {
  event: 'check',
  location: 'map-pin',
  schedule: 'clock',
  menu: 'book-open',
  guests: 'user-plus',
  invites: 'message-circle',
  moment: 'camera',
};

/** "What's left to do": the organizer's next few checklist steps, each opening its own place. */
function NextSteps({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { ready, steps, allDone } = useGettingStarted(eventId);
  if (!ready || allDone) return null;

  return (
    <View style={[styles.section, styles.sectionRule, { borderTopColor: tokens.border }]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('acasa.nextStepsTitle')}</Text>
        <TouchableOpacity onPress={openGettingStarted} activeOpacity={0.7} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.seeAll, { color: tokens.accentText }]}>{t('acasa.seeAll')}</Text>
        </TouchableOpacity>
      </View>
      {steps
        .filter((step) => !step.done)
        .slice(0, 3)
        .map((step) => (
          <TouchableOpacity
            key={step.key}
            style={styles.stepRow}
            onPress={step.showMe ?? undefined}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={[styles.stepIcon, { backgroundColor: tokens.accentTint }]}>
              <Feather name={STEP_ICONS[step.key]} size={18} color={tokens.accentText} />
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
                {t(`gettingStarted.steps.${step.key}.title`)}
              </Text>
              <Text style={[styles.stepSub, { color: tokens.textSecondary }]} numberOfLines={1}>
                {t(`gettingStarted.steps.${step.key}.tip`)}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={tokens.textSecondary} />
          </TouchableOpacity>
        ))}
    </View>
  );
}

/** "HH:MM" to minutes after midnight; null when it doesn't parse. */
function minutesOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (match === null) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < 24 * 60 ? minutes : null;
}

/**
 * "Up next" card under the countdown, only when the day is close: in the last
 * 3 days the first few items of the Program; on the day itself what's on now
 * and what's next (refreshed every minute). Hidden otherwise, and when the
 * Program is empty. Items without a time are left out.
 */
function UpNextCard({ eventId, date, schedule }: { eventId: string; date: string; schedule: ScheduleItem[] }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const days = daysUntilEvent(date);
  const today = days === 0;
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    if (!today) return;
    const timer = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60_000);
    return () => clearInterval(timer);
  }, [today]);

  const timed = schedule
    .map((item) => ({ item, minutes: minutesOf(item.time) }))
    .filter((entry): entry is { item: ScheduleItem; minutes: number } => entry.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes);
  if (days === null || days < 0 || days > 3 || timed.length === 0) return null;

  const rows: { label: string; item: ScheduleItem; highlight: boolean }[] = [];
  if (today) {
    const startedIndex = timed.reduce((found, entry, index) => (entry.minutes <= nowMinutes ? index : found), -1);
    const current = timed[startedIndex];
    const next = timed[startedIndex + 1];
    if (current !== undefined) rows.push({ label: t('acasa.now'), item: current.item, highlight: true });
    if (next !== undefined) rows.push({ label: t('acasa.upNext'), item: next.item, highlight: current === undefined });
  } else {
    timed.slice(0, 3).forEach((entry) => rows.push({ label: entry.item.time, item: entry.item, highlight: false }));
  }

  return (
    <View style={[styles.upNext, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Text style={[styles.upNextTitle, { color: tokens.textPrimary }]}>
        {today ? t('acasa.todayTitle') : t('acasa.scheduleTitle')}
      </Text>
      {rows.map((row) => (
        <View key={`${row.label}-${row.item.id}`} style={styles.upNextRow}>
          <View
            style={[
              styles.upNextLabel,
              { backgroundColor: row.highlight ? tokens.accentFill : tokens.surface2 },
            ]}
          >
            <Text style={[styles.upNextLabelText, { color: row.highlight ? tokens.onAccent : tokens.textPrimary }]}>
              {row.label}
            </Text>
          </View>
          <View style={styles.upNextText}>
            <Text style={[styles.upNextItem, { color: tokens.textPrimary }]} numberOfLines={1}>
              {row.item.title}
            </Text>
            <Text style={[styles.upNextMeta, { color: tokens.textSecondary }]} numberOfLines={1}>
              {[today ? row.item.time : null, row.item.location.trim() || null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
      ))}
      <TouchableOpacity
        onPress={() => router.push(`/detalii-schedule/${eventId}`)}
        activeOpacity={0.7}
        accessibilityRole="button"
        style={styles.upNextLink}
      >
        <Text style={[styles.upNextLinkText, { color: tokens.accentText }]}>{t('acasa.seeSchedule')}</Text>
        <Feather name="chevron-right" size={16} color={tokens.accentText} />
      </TouchableOpacity>
    </View>
  );
}

export default function AcasaScreen() {
  const { event } = useGuestEvent();
  const { isOwner } = useEvents();
  if (event?.type === 'spontaneous') return <SpontaneousHome event={event} owner={isOwner(event)} />;
  if (event?.type === 'venue') return <VenueTonight event={event} owner={isOwner(event)} />;
  return <StoryAcasa />;
}

function StoryAcasa() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner, isPrimaryOwner } = useEvents();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { content, toggleReaction, hasReacted, reactionCount, deleteMoment } = useEventContent(id);
  const postMomentRef = useTourTarget(TOUR_TARGETS.moment);

  const owner = isOwner(event);
  // Finished events are an archive: moments can't be edited or deleted there.
  const canEditMoments = owner && (event === undefined || !isEventPast(event.date));
  // Your own moments; the event owner can also edit co-organizers' moments
  // (same rule as the moments RLS policies).
  const canEditMoment = (organizerId: string) =>
    canEditMoments && (isPrimaryOwner(event) || (user !== null && organizerId === user.id));
  // Distance from the true screen bottom up to the tab bar's top edge — the
  // FAB and this screen's own extra bottom padding both build on it.
  const tabBarClearance = tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height;

  if (content === null) {
    return (
      <GuestScreen transparent>
        {event !== undefined ? <EventHero event={event} canEdit={canEditMoments} /> : null}
        {event !== undefined ? <EventCountdown
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
        {event !== undefined ? <EventHero event={event} canEdit={canEditMoments} /> : null}
        {event !== undefined ? <EventCountdown
            date={event.date}
            type={event.type}
            scheduleTimes={content.schedule.map((item) => item.time)}
          /> : null}

        {/* Organizer's checklist while the event is still ahead. */}
        {owner && event !== undefined && !isEventPast(event.date) ? <NextSteps eventId={id} /> : null}

        {/* Finished event with its album ready: the story of the whole thing. */}
        {event !== undefined && isEventPast(event.date) && isStoryReady(event) ? <StoryEntryCard event={event} /> : null}

        {event !== undefined ? <UpNextCard eventId={id} date={event.date} schedule={content.schedule} /> : null}

        <View style={[styles.sectionRule, { borderTopColor: tokens.border }]}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('acasa.momentsTitle')}</Text>
        </View>

        {content.moments.length === 0 ? (
          <EmptyState message={canEditMoments ? t('acasa.emptyOwner') : t('acasa.emptyGuest')} />
        ) : null}

        {content.moments.map((moment, index) => (
          <Animated.View key={moment.id} entering={staggerIn(index)}>
              <MomentCard
                moment={moment}
                loveCount={reactionCount(moment.id, 'love')}
                celebrateCount={reactionCount(moment.id, 'celebrate')}
                lovedByMe={hasReacted(moment.id, 'love')}
                celebratedByMe={hasReacted(moment.id, 'celebrate')}
                onReact={(reaction) => toggleReaction(moment.id, reaction)}
                onLongPress={
                  canEditMoment(moment.organizer_id)
                    ? () => {
                        haptics.press();
                        showActionSheet({
                          title: moment.title,
                          actions: [
                            {
                              label: t('common.edit'),
                              tone: 'edit',
                              onPress: () => router.push(`/post-moment/${id}?momentId=${moment.id}`),
                            },
                            {
                              label: t('common.delete'),
                              tone: 'delete',
                              onPress: () =>
                                confirmDelete(
                                  t('acasa.deleteMomentTitle'),
                                  t('acasa.deleteMomentBody', { title: moment.title }),
                                  () => deleteMoment(moment.id),
                                ),
                            },
                          ],
                        });
                      }
                    : canEditMoments
                      ? () => {
                          // Co-organizer on someone else's moment: say why, instead of nothing.
                          haptics.press();
                          showDialog({
                            title: t('acasa.cantEditOthersTitle'),
                            message:
                              moment.author_label !== null
                                ? t('acasa.cantEditOthersBody', { name: moment.author_label })
                                : t('acasa.cantEditOthersBodyUnknown'),
                          });
                        }
                      : undefined
                }
              />
          </Animated.View>
        ))}

        {FUND_ENABLED && content.fund !== null ? (
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

      {/* No new moments once the event is over: the story is in the album now. */}
      {owner && (event === undefined || !isEventPast(event.date)) ? (
        <TouchableOpacity
          ref={postMomentRef}
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
  section: {
    gap: 14,
  },
  sectionRule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: typeface.display,
    fontSize: 22,
    lineHeight: 28,
  },
  seeAll: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  stepTitle: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 15,
  },
  stepSub: {
    fontSize: 13,
  },
  upNext: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  upNextTitle: {
    fontFamily: typeface.bodyBold,
    fontSize: 16,
  },
  upNextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upNextLabel: {
    minWidth: 64,
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  upNextLabelText: {
    fontFamily: typeface.bodyBold,
    fontSize: 13,
  },
  upNextText: {
    flex: 1,
    minWidth: 0,
  },
  upNextItem: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 15,
  },
  upNextMeta: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
  upNextLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    minHeight: 32,
  },
  upNextLinkText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
    flexShrink: 1,
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
