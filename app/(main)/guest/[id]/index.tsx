import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { floatingTabBar, fonts, gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';
import { WEB_CONTENT_WIDTH } from '@/utils/webLayout';

export default function AcasaScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { content, toggleReaction, hasReacted, reactionCount, deleteMoment } =
    useEventContent(id);

  const owner = isOwner(event);
  // Distance from the true screen bottom up to the floating tabs bar's top
  // edge — the FAB and this screen's own extra bottom padding both build on
  // it. On web the floating bar is hidden and its own "add a moment" action
  // moved into EventTopMenu instead (see `showFab` below), so there's
  // nothing to clear beyond the usual safe area.
  const tabBarClearance =
    Platform.OS === 'web'
      ? insets.bottom + gSpace.lg
      : insets.bottom + floatingTabBar.gap + floatingTabBar.height;

  if (content === null) {
    return (
      <GuestScreen transparent webMaxWidth={WEB_CONTENT_WIDTH.narrow}>
        <SectionLabel>{t('acasa.sectionLabel')}</SectionLabel>
        <MomentCardSkeleton />
        <MomentCardSkeleton />
      </GuestScreen>
    );
  }

  // The floating FAB below is native-only now — its web equivalent lives in
  // EventTopMenu's top menu (app/(main)/guest/[id]/_layout.tsx) — so the
  // extra bottom padding reserved to clear it only applies on native too.
  const showFab = owner && Platform.OS !== 'web';

  return (
    <View style={styles.wrap}>
      <GuestScreen
        contentStyle={showFab ? { paddingBottom: tabBarClearance + gSpace.xxl + 58 } : undefined}
        transparent
        webMaxWidth={WEB_CONTENT_WIDTH.narrow}
      >
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

      {showFab ? (
        // Two nested wrappers instead of a flat `right: gSpace.xl` so the FAB
        // tracks the content column rather than the physical screen edge —
        // see GuestScreen's webMaxWidth. `box-none` keeps the otherwise-empty
        // full-width shelf from eating touches meant for the scroll content
        // underneath it. Native only — on web this action lives in
        // EventTopMenu's top menu instead (see `showFab` above).
        <View
          pointerEvents="box-none"
          style={[styles.fabShelf, { bottom: tabBarClearance + gSpace.md }]}
        >
          <View pointerEvents="box-none" style={styles.fabColumn}>
            <TouchableOpacity
              style={[styles.fab, { backgroundColor: tokens.accentPrimary }]}
              onPress={() => router.push(`/post-moment/${id}`)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Postează un moment"
            >
              <Feather name="plus" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
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
  fabShelf: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fabColumn: {
    width: '100%',
    alignItems: 'flex-end',
    paddingRight: gSpace.xl,
  },
  fab: {
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
