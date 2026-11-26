import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { EventCover } from '@/components/EventCover';
import { EventTypeIcon, LineIcon, type Shape } from '@/components/EventTypeIcon';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { openEventMenu, type EventMenuAction } from '@/components/EventMenu';
import { ScaleTouchable } from '@/components/ScaleTouchable';
import { Skeleton } from '@/components/Skeleton';
import { currentStage, stageKeys } from '@/components/StoryTimeline';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import { eventTypeLabel } from '@/utils/eventTypes';
import { countRsvps, daysUntilEvent, eventShortSubtitle } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { pastCoverShade, themeRadius, typeface } from '@/utils/themeTokens';

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
      <Text
        style={[
          days === 0 ? styles.daysWord : styles.daysNumber,
          { color: tokens.accentText, fontFamily: tokens.displayFont },
        ]}
      >
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

/** Lucide "crown" (ISC), same as the chat's organizer badge and the website's. */
const CROWN: readonly Shape[] = [
  {
    type: 'path',
    d: 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z',
  },
  { type: 'path', d: 'M5 21h14' },
];

export interface EventRole {
  /** 'owner': your own event (crown, accent). 'member': co-organizer or restaurant (people, neutral). */
  kind: 'owner' | 'member';
  label: string;
}

/** How you're on an event, as an icon only, pinned to the bottom-right of the cover photo. */
function RoleBadge({ role, size }: { role: EventRole; size: number }) {
  const { tokens } = useTheme();
  const owner = role.kind === 'owner';
  const icon = Math.round(size * 0.5);
  return (
    <View
      accessible
      accessibilityLabel={role.label}
      style={[
        styles.roleBadge,
        { width: size, height: size, borderRadius: size / 2, borderColor: tokens.surface },
        { backgroundColor: owner ? tokens.accentFill : tokens.surface },
      ]}
    >
      {owner ? (
        <LineIcon shapes={CROWN} size={icon} color={tokens.onAccent} strokeWidth={2.2} />
      ) : (
        <Feather name="users" size={icon} color={tokens.textSecondary} />
      )}
    </View>
  );
}

/** "Următorul" card: cover, name + countdown, four-segment stage bar, one action. */
export function DashboardHero({
  event,
  onPress,
  menuActions = [],
  onPressInvite,
  role = null,
}: {
  event: AppEvent;
  onPress: () => void;
  /** Edit / Delete, in a bottom sheet on long press. */
  menuActions?: readonly EventMenuAction[];
  onPressInvite: () => void;
  role?: EventRole | null;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const days = daysUntilEvent(event.date);
  const past = days !== null && days < 0;
  const stage = currentStage(days);
  const stageName = t(stageKeys(event)[stage] ?? 'onboarding.stageJourney');
  const counts = countRsvps(event.guests);
  const noGuests = event.guests.length === 0;

  return (
    <ScaleTouchable
      scaleTo={0.98}
      onPress={onPress}
      onLongPress={() => openEventMenu(event.name, menuActions)}
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
      <EventCover type={event.type} coverTheme={event.coverTheme} photoPath={event.coverPhotoPath} style={styles.cover}>
        {past ? <View style={[StyleSheet.absoluteFill, { backgroundColor: pastCoverShade }]} /> : null}
        <View style={[styles.nextLabel, { backgroundColor: tokens.surface }]}>
          <Text style={[styles.nextLabelText, { color: tokens.accentText }]}>{t('home.dashboard.next')}</Text>
        </View>
        <View style={styles.typeChip}>
          <EventTypeIcon type={event.type} size={14} color={CHIP_TEXT} />
          <Text style={styles.typeChipText} numberOfLines={1}>
            {eventTypeLabel(event, t)}
          </Text>
        </View>
        {role !== null ? (
          <View style={styles.roleOnCover}>
            <RoleBadge role={role} size={30} />
          </View>
        ) : null}
      </EventCover>

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
  menuActions = [],
  showDivider,
  role = null,
}: {
  event: AppEvent;
  onPress: () => void;
  menuActions?: readonly EventMenuAction[];
  showDivider: boolean;
  role?: EventRole | null;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const days = daysUntilEvent(event.date);
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={() => openEventMenu(event.name, menuActions)}
      delayLongPress={350}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={event.name}
      style={[styles.row, showDivider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.border }]}
    >
      <View>
        <EventCover
          type={event.type}
          coverTheme={event.coverTheme}
          photoPath={event.coverPhotoPath}
          thumbnail
          style={[styles.thumb, days !== null && days < 0 && styles.pastThumb]}
        />
        {role !== null ? (
          <View style={styles.roleOnThumb}>
            <RoleBadge role={role} size={20} />
          </View>
        ) : null}
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: tokens.textPrimary, fontFamily: tokens.displayFont }]} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={[styles.meta, { color: tokens.textSecondary }]} numberOfLines={1}>
          {eventTypeLabel(event, t)} · {eventShortSubtitle(event)}
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

// On-cover chip colors, same as EventHero's type pill.
const CHIP_TEXT = '#2A211C';

const styles = StyleSheet.create({
  typeChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    maxWidth: '60%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: themeRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  typeChipText: {
    flexShrink: 1,
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
    color: CHIP_TEXT,
  },
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
  daysWord: {
    fontSize: 22,
    lineHeight: 28,
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
  roleBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  roleOnCover: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  roleOnThumb: {
    position: 'absolute',
    right: -4,
    bottom: -4,
  },
  rowName: {
    fontSize: 18,
  },
  rowDays: {
    fontFamily: typeface.bodyMedium,
    fontSize: 13,
  },
});
