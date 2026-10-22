import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Skeleton } from '@/components/Skeleton';
import { Avatar, Bar, DeletableRow, Eyebrow, SpCard } from '@/components/spontaneous/parts';
import { useEventContent } from '@/hooks/useEventContent';
import { useSpontaneous } from '@/hooks/useSpontaneous';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import { daysUntilEvent } from '@/utils/format';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';
import { haptics } from '@/utils/haptics';
import { staggerIn } from '@/utils/motion';
import { timeAgo } from '@/utils/relativeTime';
import { formatSpontaneousWhen } from '@/utils/spontaneous';
import { accentButtonShadow, themeRadius, typography } from '@/utils/themeTokens';

const MAX_AVATARS = 6;

/**
 * Acasă for a spontaneous event: countdown card, who's
 * coming, the group vote, the host's updates (moments without a photo, same
 * table and composer as every other type), then a nudge to the Plan tab.
 */
export function SpontaneousHome({ event, owner }: { event: AppEvent; owner: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { content, myPollVote, vote } = useSpontaneous(event.id);
  const { content: social, deleteMoment } = useEventContent(event.id);
  const days = daysUntilEvent(event.date);
  const tabBarClearance = tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height;

  const attendees = content?.attendees ?? [];
  const going = attendees.filter((a) => a.status === 'confirmed');
  const maybe = attendees.filter((a) => a.status === 'maybe');
  const goingPeople = going.reduce((sum, a) => sum + 1 + (a.plusOne ? 1 : 0), 0);
  const poll = content?.poll ?? null;
  const totalVotes = content?.pollVotes.length ?? 0;
  const template = event.template ?? 'party';

  return (
    <View style={styles.wrap}>
      <GuestScreen
        contentStyle={owner ? { paddingBottom: tabBarClearance + gSpace.xxl + 56 } : undefined}
        transparent
      >
        <SpCard style={styles.countdown}>
          {days !== null && days >= 0 ? (
            <View style={styles.daysBox}>
              <Text style={[styles.daysValue, { color: tokens.accentText }]}>{days}</Text>
              <Text style={[styles.daysLabel, { color: tokens.textSecondary }]}>
                {days === 0 ? t('spontaneous.home.today') : t('spontaneous.home.daysLeft', { count: days })}
              </Text>
            </View>
          ) : null}
          <View style={styles.countdownText}>
            <Text style={[styles.countdownTitle, { color: tokens.textPrimary }]} numberOfLines={2}>
              {event.name}
            </Text>
            <Text style={[styles.countdownWhen, { color: tokens.textSecondary }]}>
              {formatSpontaneousWhen(event.date, event.startTime)}
            </Text>
            {event.location.trim().length > 0 ? (
              <Text style={[styles.countdownWhen, { color: tokens.textSecondary }]} numberOfLines={1}>
                {event.location}
              </Text>
            ) : null}
          </View>
        </SpCard>

        <SpCard>
          <Eyebrow right={t('spontaneous.home.counts', { yes: goingPeople, maybe: maybe.length })}>
            {t('spontaneous.home.whoComes')}
          </Eyebrow>
          {content === null ? (
            <Skeleton height={34} width="70%" radius={17} />
          ) : going.length + maybe.length === 0 ? (
            <Text style={[styles.muted, { color: tokens.textSecondary }]}>{t('spontaneous.home.nobodyYet')}</Text>
          ) : (
            <View style={styles.avatars}>
              {[...going, ...maybe].slice(0, MAX_AVATARS).map((attendee, index) => (
                <View key={attendee.guestId} style={index > 0 ? styles.overlap : undefined}>
                  <Avatar name={attendee.name} index={index} />
                </View>
              ))}
              {going.length + maybe.length > MAX_AVATARS ? (
                <View style={[styles.more, styles.overlap, { backgroundColor: tokens.accentTint, borderColor: tokens.surface }]}>
                  <Text style={[styles.moreText, { color: tokens.accentText }]}>
                    +{going.length + maybe.length - MAX_AVATARS}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </SpCard>

        {poll !== null ? (
          <SpCard>
            <Eyebrow>{t('spontaneous.poll.eyebrow')}</Eyebrow>
            <View style={styles.pollHead}>
              <Text style={[styles.pollQuestion, { color: tokens.textPrimary }]}>{poll.question}</Text>
              {owner ? (
                <TouchableOpacity
                  onPress={() => router.push(`/poll/${event.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={t('spontaneous.poll.edit')}
                  hitSlop={10}
                >
                  <Feather name="edit-2" size={17} color={tokens.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            {poll.options.map((option) => {
              const count = content?.pollVotes.filter((v) => v.optionId === option.id).length ?? 0;
              const mine = myPollVote === option.id;
              return (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => {
                    if (mine) return;
                    haptics.tap();
                    vote(option.id);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: mine }}
                  accessibilityLabel={`${option.label}, ${count}`}
                  style={[
                    styles.option,
                    { borderColor: mine ? tokens.accentPrimary : tokens.border, borderWidth: mine ? 2 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.optionFill,
                      { backgroundColor: tokens.accentTint, width: `${totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0}%` },
                    ]}
                  />
                  <Text style={[styles.optionLabel, { color: tokens.textPrimary }]}>{option.label}</Text>
                  <Text style={[styles.optionCount, { color: tokens.textPrimary }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
            <Text style={[styles.hint, { color: tokens.textSecondary }]}>
              {myPollVote !== null ? t('spontaneous.poll.voted') : t('spontaneous.poll.hint')}
            </Text>
          </SpCard>
        ) : owner ? (
          <SpCard>
            <Eyebrow>{t('spontaneous.poll.eyebrow')}</Eyebrow>
            <Text style={[styles.muted, { color: tokens.textSecondary }]}>{t('spontaneous.poll.emptyOwner')}</Text>
            <Button label={t('spontaneous.poll.create')} variant="tonal" onPress={() => router.push(`/poll/${event.id}`)} />
          </SpCard>
        ) : null}

        <Eyebrow>{t('spontaneous.home.fromHost')}</Eyebrow>
        {social === null ? (
          <Skeleton height={56} radius={18} />
        ) : social.moments.length === 0 ? (
          <Text style={[styles.muted, { color: tokens.textSecondary }]}>
            {owner ? t('spontaneous.home.noUpdatesOwner') : t('spontaneous.home.noUpdates')}
          </Text>
        ) : (
          social.moments.map((moment, index) => (
            <Animated.View key={moment.id} entering={staggerIn(index)}>
              <DeletableRow
                enabled={owner}
                title={moment.title}
                confirm={{ title: t('acasa.deleteMomentTitle'), message: t('acasa.deleteMomentBody', { title: moment.title }) }}
                onDelete={() => deleteMoment(moment.id)}
              >
                <View style={[styles.update, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
                  <View style={[styles.updateDot, { backgroundColor: tokens.accentTint }]}>
                    <Feather name="bell" size={15} color={tokens.accentText} />
                  </View>
                  <View style={styles.updateText}>
                    <Text style={[styles.updateTitle, { color: tokens.textPrimary }]}>{moment.title}</Text>
                    <Text style={[styles.updateTime, { color: tokens.textSecondary }]}>{timeAgo(moment.created_at)}</Text>
                  </View>
                </View>
              </DeletableRow>
            </Animated.View>
          ))
        )}

        <SpCard style={{ backgroundColor: tokens.accentTint, borderColor: tokens.accentTint }}>
          <Text style={[styles.ctaText, { color: tokens.textPrimary }]}>{t(`spontaneous.templates.${template}.planCta`)}</Text>
          <Button label={t('spontaneous.home.seePlan')} onPress={() => router.push(`/guest/${event.id}/detalii`)} />
        </SpCard>

        {content !== null && content.bill !== null ? (
          <SpCard>
            <Eyebrow>{t('spontaneous.bill.eyebrow')}</Eyebrow>
            <Bar
              ratio={(attendees.filter((a) => a.billConfirmedAt !== null).length + 1) / content.bill.peopleCount}
            />
            <Button label={t('spontaneous.home.seeBill')} variant="tonal" onPress={() => router.push(`/guest/${event.id}/fond`)} />
          </SpCard>
        ) : null}
      </GuestScreen>

      {owner ? (
        <TouchableOpacity
          style={[
            styles.fab,
            { backgroundColor: tokens.accentFill, bottom: tabBarClearance + gSpace.lg },
            tokens.mode === 'light' ? accentButtonShadow : undefined,
          ]}
          onPress={() => router.push(`/post-moment/${event.id}`)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('spontaneous.home.postUpdate')}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  daysBox: {
    alignItems: 'center',
    minWidth: 64,
  },
  daysValue: {
    ...typography.display,
    fontSize: 46,
    lineHeight: 52,
  },
  daysLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  countdownText: {
    flex: 1,
    gap: 3,
  },
  countdownTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  countdownWhen: {
    fontSize: 13,
    opacity: 0.9,
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlap: {
    marginLeft: -8,
  },
  more: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pollHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pollQuestion: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  option: {
    minHeight: 46,
    borderRadius: 14,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  optionFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
  },
  optionCount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: 12,
  },
  update: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  updateDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateText: {
    flex: 1,
    gap: 2,
  },
  updateTitle: {
    fontSize: 14.5,
  },
  updateTime: {
    fontSize: 12,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21,
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
