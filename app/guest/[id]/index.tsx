import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { getEventType } from '@/utils/eventTypes';
import { daysUntilEvent } from '@/utils/format';
import { floatingTabBar, gSpace } from '@/utils/guestTheme';
import { accentButtonShadow, themeRadius, typography } from '@/utils/themeTokens';

/** "Mai sunt 255 de zile · până la Ziua X" card with the four-stage timeline. */
function CountdownCard({ date }: { date: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const days = daysUntilEvent(date);

  const headline =
    days === null || days > 0
      ? days === null
        ? null
        : t('acasa.countdown', { count: days })
      : days === 0
        ? t('acasa.countdownToday')
        : t('acasa.countdownPast');

  return (
    <View style={[styles.countdown, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      {headline !== null ? (
        <View style={styles.countdownHead}>
          <Text style={[styles.countdownTitle, { color: tokens.textPrimary }]}>{headline}</Text>
          {days !== null && days > 0 ? (
            <Text style={[styles.countdownSub, { color: tokens.textSecondary }]}>{t('acasa.untilDayX')}</Text>
          ) : null}
        </View>
      ) : null}
      <StoryTimeline stage={currentStage(days)} />
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
  const tabBarClearance = insets.bottom + floatingTabBar.gap + floatingTabBar.height;
  const authorBadge = getEventType(event?.type ?? null).emoji;

  if (content === null) {
    return (
      <GuestScreen transparent>
        {event !== undefined ? <CountdownCard date={event.date} /> : null}
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
        {event !== undefined ? <CountdownCard date={event.date} /> : null}

        {content.moments.length === 0 ? (
          <EmptyState message={owner ? t('acasa.emptyOwner') : t('acasa.emptyGuest')} />
        ) : null}

        {content.moments.map((moment) => (
          <SwipeableRow
            key={moment.id}
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
              authorBadge={authorBadge}
              loveCount={reactionCount(moment.id, 'love')}
              celebrateCount={reactionCount(moment.id, 'celebrate')}
              lovedByMe={hasReacted(moment.id, 'love')}
              celebratedByMe={hasReacted(moment.id, 'celebrate')}
              onReact={(reaction) => toggleReaction(moment.id, reaction)}
            />
          </SwipeableRow>
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
  countdownHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  countdownTitle: {
    ...typography.title2,
    flexShrink: 1,
  },
  countdownSub: {
    fontSize: 13,
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
