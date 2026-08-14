import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { ProgressBar } from '@/components/guest/ProgressBar';
import { Skeleton } from '@/components/Skeleton';
import { confirmDelete } from '@/utils/confirm';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';
import { formatMoney } from '@/utils/money';
import { WEB_CONTENT_WIDTH } from '@/utils/webLayout';

export default function FondScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, deleteFund } = useEventContent(id);

  const card = [
    styles.card,
    {
      backgroundColor: tokens.surfaceElevated,
      borderColor: tokens.surfaceBorder ?? 'transparent',
      borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
    },
    tokens.surfaceElevatedShadow ?? undefined,
  ];

  if (content === null) {
    return (
      <GuestScreen contentStyle={styles.page} transparent webMaxWidth={WEB_CONTENT_WIDTH.narrow}>
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
  const { fund } = content;

  if (fund === null) {
    return (
      <GuestScreen contentStyle={styles.page} transparent webMaxWidth={WEB_CONTENT_WIDTH.narrow}>
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

  const removeFund = () => {
    const message =
      contributorCount > 0
        ? t('fond.deleteFundWithContributions', { title: fund.title, count: contributorCount })
        : t('fond.deleteFundNoContributions', { title: fund.title });
    confirmDelete(t('fond.deleteFundTitle'), message, deleteFund);
  };

  return (
    <GuestScreen contentStyle={styles.page} transparent>
      <View style={card}>
        {owner ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={[styles.edit, { backgroundColor: `${tokens.accentPrimary}22` }]}
              onPress={() => router.push(`/fund/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează fondul"
            >
              <Feather name="edit-2" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.delete, { backgroundColor: tokens.destructiveSoft }]}
              onPress={removeFund}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Șterge fondul"
            >
              <Feather name="trash-2" size={16} color={tokens.destructive} />
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={[styles.eyebrow, { color: tokens.textSecondary }]}>{fund.title.toUpperCase()}</Text>
        <Text style={[styles.message, { color: tokens.textSecondary }]}>{fund.description}</Text>

        <View style={styles.amounts}>
          <Text style={[styles.current, { color: tokens.accentPrimary }]}>
            {formatMoney(fund.current_amount, fund.currency)}
          </Text>
          <Text style={[styles.target, { color: tokens.textSecondary }]}>
            {t('fond.targetAmount', { amount: formatMoney(fund.target_amount, fund.currency) })}
          </Text>
        </View>

        <ProgressBar current={fund.current_amount} target={fund.target_amount} />

        <Text style={[styles.contributors, { color: tokens.textSecondary }]}>
          {t('fond.contributorsCount', { count: contributorCount })}
        </Text>

        {!owner ? (
          <GuestButton
            label={t('fond.contributeNow')}
            style={styles.cta}
            onPress={() => router.push(`/checkout/${id}`)}
          />
        ) : null}
      </View>

      {!owner ? (
        <Text style={[styles.disclaimer, { color: tokens.textSecondary }]}>{t('fond.disclaimer')}</Text>
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
    borderRadius: themeRadius.lg,
    padding: gSpace.xxl,
    alignItems: 'center',
    gap: gSpace.md,
  },
  ownerActions: {
    position: 'absolute',
    top: gSpace.lg,
    right: gSpace.lg,
    flexDirection: 'row',
    gap: gSpace.sm,
  },
  edit: {
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delete: {
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
  },
  amounts: {
    alignItems: 'center',
    gap: gSpace.xs,
    marginTop: gSpace.sm,
  },
  current: {
    fontFamily: fonts.displayBold,
    fontSize: 40,
    lineHeight: 48,
  },
  target: {
    fontSize: 13,
  },
  contributors: {
    fontSize: 13,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: gSpace.sm,
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
  },
});
