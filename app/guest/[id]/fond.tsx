import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Button, buttonLabelColor } from '@/components/Button';
import { GuestButton } from '@/components/guest/GuestButton';
import { LockedFeature } from '@/components/guest/LockedFeature';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { ProgressBar } from '@/components/guest/ProgressBar';
import { Skeleton } from '@/components/Skeleton';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useTheme } from '@/hooks/useTheme';
import { gRadius } from '@/utils/guestTheme';
import { typography } from '@/utils/themeTokens';
import { formatMoney } from '@/utils/money';

export default function FondScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content } = useEventContent(id);
  const { hydrated: planHydrated, capabilities } = usePlanGate(id);

  const card = [
    styles.card,
    { backgroundColor: tokens.surface, borderColor: tokens.border },
    tokens.surfaceElevatedShadow ?? undefined,
  ];

  if (content === null) {
    return (
      <GuestScreen contentStyle={styles.page} transparent>
        <View style={card}>
          <Skeleton height={11} width="50%" radius={4} />
          <Skeleton height={14} width="85%" radius={4} />
          <Skeleton height={40} width="60%" radius={6} />
          <Skeleton height={10} radius={gRadius.pill} style={styles.skeletonTrack} />
          <Skeleton height={13} width="70%" radius={4} />
        </View>
      </GuestScreen>
    );
  }

  const owner = isOwner(event);

  // The contribution fund isn't included in this event's current plan
  // (Esențial). Checked before the "no fund yet" empty state below, since
  // that state's own CTA would let an owner attempt to open a fund that
  // fund-insert's server-side trigger (see the plan-feature-gating
  // migration) would then reject anyway.
  if (planHydrated && !capabilities.contributionsEnabled) {
    return (
      <GuestScreen transparent>
        <LockedFeature kind="fond" eventId={id} owner={owner} />
      </GuestScreen>
    );
  }

  const { fund } = content;

  if (fund === null) {
    return (
      <GuestScreen contentStyle={styles.page} transparent>
        <EmptyState
          message={owner ? t('fond.emptyOwner') : t('fond.emptyGuest')}
          action={
            owner ? (
              <GuestButton label={t('fond.openFund')} onPress={() => router.push(`/fund/${id}`)} />
            ) : undefined
          }
        />
      </GuestScreen>
    );
  }

  // Nothing writes to contributions yet — Stripe isn't wired up — so this stays 0
  // until checkout actually records a contribution.
  const contributorCount = content.contributions.length;

  const percent =
    fund.target_amount > 0 ? Math.min(100, Math.round((fund.current_amount / fund.target_amount) * 100)) : 0;

  return (
    <GuestScreen transparent>
      <View style={card}>
        <View style={styles.headBlock}>
          <Text style={[styles.overline, { color: tokens.accentText }]}>{t('fond.overline')}</Text>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{fund.title}</Text>
          {fund.description.trim().length > 0 ? (
            <Text style={[styles.message, { color: tokens.textSecondary }]}>{fund.description}</Text>
          ) : null}
        </View>

        <View style={styles.amounts}>
          <Text style={[styles.current, { color: tokens.textPrimary }]}>
            {formatMoney(fund.current_amount, fund.currency)}
          </Text>
          <Text style={[styles.target, { color: tokens.textSecondary }]}>
            {t('fond.targetAmount', { amount: formatMoney(fund.target_amount, fund.currency) })}
          </Text>
        </View>

        <ProgressBar current={fund.current_amount} target={fund.target_amount} />

        <View style={styles.statsRow}>
          <Text style={[styles.stat, { color: tokens.textSecondary }]}>
            {t('fond.contributorsCount', { count: contributorCount })}
          </Text>
          <Text style={[styles.stat, { color: tokens.textSecondary }]}>
            <Text style={[styles.statStrong, { color: tokens.textPrimary }]}>{percent}%</Text> {t('fond.ofGoal')}
          </Text>
        </View>
      </View>

      {!owner ? (
        <>
          <Button
            label={t('fond.contribute')}
            icon={<Feather name="gift" size={20} color={buttonLabelColor('primary', tokens)} />}
            onPress={() => router.push(`/checkout/${id}`)}
          />
          <View style={styles.disclaimerRow}>
            <Feather name="shield" size={15} color={tokens.textSecondary} />
            <Text style={[styles.disclaimer, { color: tokens.textSecondary }]}>{t('fond.disclaimer')}</Text>
          </View>
        </>
      ) : null}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  page: {
    justifyContent: 'center',
    flexGrow: 1,
  },
  skeletonTrack: {
    alignSelf: 'stretch',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  headBlock: {
    gap: 6,
  },
  overline: {
    ...typography.overline,
  },
  title: {
    ...typography.title2,
    fontSize: 24,
    lineHeight: 29,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  current: {
    ...typography.display,
  },
  target: {
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  stat: {
    fontSize: 13,
    flexShrink: 1,
  },
  statStrong: {
    fontWeight: '700',
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  disclaimer: {
    fontSize: 12,
  },
});
