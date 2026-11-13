import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showActionSheet } from '@/components/ActionSheet';
import { defaultCover, EventCover } from '@/components/EventCover';
import { CoverStatusContext } from '@/components/guest/eventChrome';
import { StoryTimeline, currentStage } from '@/components/StoryTimeline';
import { useEventCoverPhoto } from '@/hooks/useEventCoverPhoto';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent, EventTypeId } from '@/types/event';
import { getCoverTheme } from '@/utils/coverThemes';
import { daysUntilEvent, eventStartTime, formatEventDate } from '@/utils/format';
import { gSpace } from '@/utils/guestTheme';
import { themeRadius, typeface, typography } from '@/utils/themeTokens';

/**
 * Live countdown (days · hours · minutes) to the event's start: its date at
 * the earliest time in the Program, or midnight without one. Once the start
 * passes it's the type's day-of headline, then "the story continues" after
 * the day. Ticks every 15s (minute resolution, no seconds).
 */
export function EventCountdown({
  date,
  type,
  scheduleTimes,
  timeline = true,
}: {
  date: string;
  type: EventTypeId;
  scheduleTimes: string[];
  /** A venue night has no story to follow, just a date. */
  timeline?: boolean;
}) {
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
      {timeline ? <StoryTimeline stage={currentStage(days)} type={type} /> : null}
    </View>
  );
}

/** Full-bleed cover with back and edit on it, then the event's name, date and place. */
export function EventHero({
  event,
  canEdit,
  meta,
  extraAction,
}: {
  event: AppEvent;
  canEdit: boolean;
  /** Line under the name; defaults to the date and place. */
  meta?: string;
  /** One more round button on the cover, for what's specific to this type of event. */
  extraAction?: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void };
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const cover = useEventCoverPhoto(event);
  const coverStatus = useContext(CoverStatusContext);
  const darkCover = cover.path !== null || !(getCoverTheme(event.coverTheme) ?? defaultCover(event.type, tokens)).light;

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

  const metaLine =
    meta ?? [formatEventDate(event.date), event.location.trim()].filter((part) => part.length > 0).join(' · ');

  return (
    <View
      style={styles.hero}
      onLayout={({ nativeEvent: { layout } }) =>
        coverStatus?.reportHeroBottom(darkCover ? layout.y + styles.heroCover.height : null)
      }
    >
      <EventCover type={event.type} coverTheme={event.coverTheme} photoPath={cover.path} style={styles.heroCover}>
        {/* Keeps the light status bar readable on a bright photo. */}
        {darkCover ? (
          <LinearGradient
            colors={['rgba(0,0,0,0.38)', 'transparent']}
            style={[styles.statusScrim, { height: insets.top + 44 }]}
            pointerEvents="none"
          />
        ) : null}
        <View style={[styles.heroActions, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={[styles.heroBack, { backgroundColor: tokens.surface }]}
            onPress={() => router.dismissTo('/')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('acasa.backHome')}
          >
            <Feather name="chevron-left" size={22} color={tokens.textPrimary} />
          </TouchableOpacity>
          {canEdit ? (
            <View style={styles.heroRight}>
              {extraAction !== undefined ? (
                <TouchableOpacity
                  style={[styles.heroBack, { backgroundColor: tokens.surface }]}
                  onPress={extraAction.onPress}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={extraAction.label}
                >
                  <Feather name={extraAction.icon} size={18} color={tokens.textPrimary} />
                </TouchableOpacity>
              ) : null}
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
        {/* A dark scrim so the white text reads on any photo or drawn cover. */}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.heroText} pointerEvents="none">
          <Text style={styles.heroName} numberOfLines={2}>
            {event.name}
          </Text>
          {metaLine.length > 0 ? (
            <Text style={styles.heroMeta} numberOfLines={1}>
              {metaLine}
            </Text>
          ) : null}
        </LinearGradient>
      </EventCover>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cancels GuestScreen's padding so the cover runs edge to edge.
  hero: {
    marginHorizontal: -gSpace.xl,
    marginTop: -gSpace.lg,
  },
  heroCover: {
    height: 260,
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: gSpace.xl,
    paddingTop: 48,
    paddingBottom: 16,
    gap: 2,
  },
  heroName: {
    fontFamily: typeface.display,
    fontSize: 28,
    lineHeight: 34,
    color: '#FFFFFF',
  },
  heroMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.85)',
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
    fontFamily: typeface.bodyMedium,
    fontSize: 44,
    lineHeight: 50,
    fontVariant: ['tabular-nums'],
  },
  leadText: {
    flex: 1,
    gap: 2,
  },
  leadUnit: {
    fontFamily: typeface.bodyMedium,
    fontSize: 16,
  },
  countdownTitle: {
    ...typography.title2,
  },
  countdownSub: {
    fontSize: 13,
  },
});
