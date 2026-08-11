import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandFlourish } from '@/components/BrandFlourish';
import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { MomentCard, MomentCardSkeleton } from '@/components/guest/MomentCard';
import { SectionLabel } from '@/components/guest/SectionLabel';
import { SwipeableRow } from '@/components/SwipeableRow';
import { confirmDelete } from '@/utils/confirm';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';

export default function AcasaScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, toggleReaction, hasReacted, reactionCount, deleteMoment } =
    useEventContent(id);

  const owner = isOwner(event);

  if (content === null) {
    return (
      <GuestScreen transparent>
        <SectionLabel>{t('acasa.sectionLabel')}</SectionLabel>
        <MomentCardSkeleton />
        <MomentCardSkeleton />
      </GuestScreen>
    );
  }

  return (
    <View style={styles.wrap}>
      <GuestScreen contentStyle={owner ? styles.contentWithFab : undefined} transparent>
        <SectionLabel>{t('acasa.sectionLabel')}</SectionLabel>

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
            loveCount={reactionCount(moment.id, 'love')}
            celebrateCount={reactionCount(moment.id, 'celebrate')}
            lovedByMe={hasReacted(moment.id, 'love')}
            celebratedByMe={hasReacted(moment.id, 'celebrate')}
            onReact={(reaction) => toggleReaction(moment.id, reaction)}
              onComments={() => router.push(`/guest/${id}/chat`)}
            />
          </SwipeableRow>
        ))}

        {content.fund !== null ? (
          <View
            style={[
              styles.promo,
              {
                backgroundColor: tokens.surfaceElevated,
                borderColor: tokens.surfaceBorder ?? 'transparent',
                borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
              },
              tokens.surfaceElevatedShadow ?? undefined,
            ]}
          >
            <BrandFlourish width={52} height={22} opacity={0.4} style={styles.promoFlourish} />
            <Text style={[styles.promoTitle, { color: tokens.textPrimary }]}>{content.fund.title}</Text>
            <Text style={[styles.promoBody, { color: tokens.textSecondary }]}>
              {t('acasa.fundPromoBody')}
            </Text>
            <GuestButton
              label={t('acasa.viewFund')}
              variant="gold"
              onPress={() => router.push(`/guest/${id}/fond`)}
            />
          </View>
        ) : null}
      </GuestScreen>

      {owner ? (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: tokens.accentPrimary }]}
          onPress={() => router.push(`/post-moment/${id}`)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Postează un moment"
        >
          <Feather name="plus" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  contentWithFab: {
    paddingBottom: 92,
  },
  promo: {
    borderRadius: themeRadius.lg,
    padding: gSpace.xxl,
    gap: gSpace.md,
  },
  promoFlourish: {
    position: 'absolute',
    top: gSpace.lg,
    right: gSpace.lg,
  },
  promoTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 30,
  },
  promoBody: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: gSpace.xs,
  },
  fab: {
    position: 'absolute',
    right: gSpace.xl,
    bottom: gSpace.xl,
    width: 58,
    height: 58,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B2A1F',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
