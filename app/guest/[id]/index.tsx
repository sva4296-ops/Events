import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showActionSheet, showDialog } from '@/components/ActionSheet';
import { BrandFlourish } from '@/components/BrandFlourish';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { EventCover } from '@/components/EventCover';
import { openGettingStarted } from '@/components/tour/GettingStartedSheet';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { StoryEntryCard } from '@/components/guest/StoryEntryCard';
import { MomentCard, MomentCardSkeleton } from '@/components/guest/MomentCard';
import { StoryTimeline, currentStage } from '@/components/StoryTimeline';
import { useTourTarget } from '@/components/tour/Tour';
import { SpontaneousHome } from '@/components/spontaneous/SpontaneousHome';
import { VenueTonight } from '@/components/venue/VenueTonight';
import { confirmDelete } from '@/utils/confirm';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEventCoverPhoto } from '@/hooks/useEventCoverPhoto';
import { useEvents } from '@/hooks/useEvents';
import { TOUR_TARGETS, useGettingStarted, type GettingStartedKey } from '@/hooks/useGettingStarted';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent, EventTypeId } from '@/types/event';
import type { ScheduleItem } from '@/types/guest';
import { isStoryReady } from '@/utils/eventStory';
import { FUND_ENABLED } from '@/utils/features';
import { daysUntilEvent, eventStartTime, formatEventDate, isEventPast } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';
import { staggerIn } from '@/utils/motion';
import { accentButtonShadow, themeRadius, typeface, typography } from '@/utils/themeTokens';

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
  // The largest non-zero unit is the headline number.
  const leadIndex = Math.max(0, units.findIndex((unit) => unit.value > 0));
  // Whole days use the same calendar count as Home, so the two can't disagree;
  // hours and minutes only take over on the day itself.
  const showDays = days !== null && days > 0;
  const lead = showDays ? { key: 'days' as const, value: days } : (units[leadIndex] ?? units[2]);

  const headline =
    days === null || counting || showDays
      ? null
      : days >= 0
        ? t(`eventTypes.${type}.countdownToday`)
        : t('acasa.countdownPast');

  // On the day: the next unit along, as in "3 ore, și 20 min până la aniversare".
  const nextUnit = showDays ? undefined : units[leadIndex + 1];
  const subLine =
    nextUnit !== undefined
      ? `${t('acasa.countdownAnd')} ${nextUnit.value} ${t(`acasa.unitShort_${nextUnit.key}`, { count: nextUnit.value })} ${untilLabel}`
      : untilLabel;
  const stage = currentStage(days);

  return (
    <View style={styles.countdown}>
      {counting || showDays ? (
        <View
          style={styles.countdownBody}
          accessible
          accessibilityLabel={`${(showDays ? [lead] : units).map((unit) => t(`acasa.unit_${unit.key}`, { count: unit.value })).join(', ')} ${untilLabel}`}
        >
          <Text style={[styles.leadValue, { color: tokens.textPrimary }]}>{lead.value}</Text>
          <View style={styles.leadText}>
            <Text style={[styles.leadUnit, { color: tokens.textPrimary }]}>
              {t(`acasa.unitShort_${lead.key}`, { count: lead.value })}
            </Text>
            <Text style={[styles.countdownSub, { color: tokens.textSecondary }]}>{subLine}</Text>
          </View>
        </View>
      ) : null}
      {headline !== null ? (
        <Text style={[styles.countdownTitle, { color: tokens.textPrimary }]}>{headline}</Text>
      ) : null}
      <StoryTimeline stage={stage} type={type} />
      <Text style={[styles.stageHint, { color: tokens.textSecondary }]}>{t(`acasa.stageHint_${stage}`)}</Text>
    </View>
  );
}

/** Full-bleed cover with back and edit on it, then the event's name, date and place. */
function EventHero({ event, canEdit }: { event: AppEvent; canEdit: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const cover = useEventCoverPhoto(event);

  const pickCover = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [16, 9],
    });
    const asset = result.canceled ? undefined : result.assets[0];
    if (asset !== undefined) cover.setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const changeCover = () => {
    if (cover.path === null) {
      void pickCover();
      return;
    }
    showActionSheet({
      title: t('acasa.coverTitle'),
      actions: [
        { label: t('acasa.coverChange'), tone: 'edit', onPress: () => void pickCover() },
        { label: t('acasa.coverRemove'), tone: 'delete', onPress: () => cover.removePhoto() },
      ],
    });
  };

  const meta = [formatEventDate(event.date), event.location.trim()].filter((part) => part.length > 0).join(' · ');

  return (
    <View style={styles.hero}>
      <EventCover type={event.type} coverTheme={event.coverTheme} photoPath={cover.path} style={styles.heroCover}>
        <View style={[styles.heroActions, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={[styles.heroBack, { backgroundColor: tokens.surface }]}
            onPress={() => router.navigate('/')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('acasa.backHome')}
          >
            <Feather name="chevron-left" size={22} color={tokens.textPrimary} />
          </TouchableOpacity>
          {canEdit ? (
            <View style={styles.heroRight}>
              <TouchableOpacity
                style={[styles.heroBack, { backgroundColor: tokens.surface }]}
                onPress={changeCover}
                disabled={cover.busy}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={t('acasa.coverTitle')}
              >
                {cover.busy ? (
                  <ActivityIndicator size="small" color={tokens.textPrimary} />
                ) : (
                  <Feather name="camera" size={18} color={tokens.textPrimary} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.heroEdit, { backgroundColor: tokens.surface }]}
                onPress={() => router.push(`/edit-event/${event.id}`)}
                activeOpacity={0.8}
                accessibilityRole="button"
              >
                <Feather name="edit-2" size={15} color={tokens.textPrimary} />
                <Text style={[styles.heroEditLabel, { color: tokens.textPrimary }]}>{t('common.edit')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </EventCover>
      <View style={styles.heroText}>
        <Text style={[styles.heroType, { color: tokens.textSecondary }]}>
          {t(`eventTypes.${event.type}.label`).toUpperCase()}
        </Text>
        <Text style={[styles.heroName, { color: tokens.textPrimary }]}>{event.name}</Text>
        {meta.length > 0 ? <Text style={[styles.heroMeta, { color: tokens.textSecondary }]}>{meta}</Text> : null}
      </View>
    </View>
  );
}

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
        {event !== undefined ? <EventHero event={event} canEdit={canEditMoments} /> : null}
        {event !== undefined ? <CountdownCard
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
  // Cancels GuestScreen's padding so the cover runs edge to edge.
  hero: {
    marginHorizontal: -gSpace.xl,
    marginTop: -gSpace.lg,
    gap: gSpace.lg,
  },
  heroCover: {
    height: 220,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  heroRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroBack: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: themeRadius.pill,
  },
  heroEditLabel: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
  },
  heroText: {
    paddingHorizontal: gSpace.xl,
    gap: 4,
  },
  heroType: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  heroName: {
    fontFamily: typeface.display,
    fontSize: 30,
    lineHeight: 36,
  },
  heroMeta: {
    fontSize: 13,
    lineHeight: 19,
  },
  countdown: {
    gap: 16,
  },
  countdownBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  leadValue: {
    fontFamily: typeface.display,
    fontSize: 64,
    lineHeight: 70,
    fontVariant: ['tabular-nums'],
  },
  leadText: {
    flex: 1,
    gap: 2,
  },
  leadUnit: {
    fontFamily: typeface.display,
    fontSize: 20,
  },
  stageHint: {
    fontSize: 14,
    lineHeight: 20,
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
  countdownTitle: {
    ...typography.title2,
  },
  countdownSub: {
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
