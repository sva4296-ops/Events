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
import { fonts, guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';
import { formatMoney } from '@/utils/money';

export default function FondScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { content, deleteFund } = useEventContent(id);

  if (content === null) {
    return (
      <GuestScreen contentStyle={styles.page} transparent>
        <View style={styles.card}>
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

  const removeFund = () => {
    const message =
      contributorCount > 0
        ? t('fond.deleteFundWithContributions', { title: fund.title, count: contributorCount })
        : t('fond.deleteFundNoContributions', { title: fund.title });
    confirmDelete(t('fond.deleteFundTitle'), message, deleteFund);
  };

  return (
    <GuestScreen contentStyle={styles.page} transparent>
      <View style={styles.card}>
        {owner ? (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.edit}
              onPress={() => router.push(`/fund/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează fondul"
            >
              <Feather name="edit-2" size={16} color={guest.purple} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.delete}
              onPress={removeFund}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Șterge fondul"
            >
              <Feather name="trash-2" size={16} color={guest.live} />
            </TouchableOpacity>
          </View>
        ) : null}

        <Text style={styles.eyebrow}>{fund.title.toUpperCase()}</Text>
        <Text style={styles.message}>{fund.description}</Text>

        <View style={styles.amounts}>
          <Text style={styles.current}>{formatMoney(fund.current_amount, fund.currency)}</Text>
          <Text style={styles.target}>
            {t('fond.targetAmount', { amount: formatMoney(fund.target_amount, fund.currency) })}
          </Text>
        </View>

        <ProgressBar current={fund.current_amount} target={fund.target_amount} />

        <Text style={styles.contributors}>
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

      {!owner ? <Text style={styles.disclaimer}>{t('fond.disclaimer')}</Text> : null}
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
    backgroundColor: guest.white,
    borderRadius: gRadius.xl,
    padding: gSpace.xxl,
    alignItems: 'center',
    gap: gSpace.md,
    ...gShadow,
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
    backgroundColor: guest.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delete: {
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    backgroundColor: guest.blush,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: guest.faint,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    color: guest.body,
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
    color: guest.purple,
  },
  target: {
    fontSize: 13,
    color: guest.faint,
  },
  contributors: {
    fontSize: 13,
    color: guest.body,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: gSpace.sm,
  },
  disclaimer: {
    fontSize: 11,
    color: guest.faint,
    textAlign: 'center',
  },
});
