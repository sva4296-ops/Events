import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandHeader } from '@/components/BrandHeader';
import { EventListItem, EventListItemSkeleton } from '@/components/EventListItem';
import { HomeEmptyState } from '@/components/HomeEmptyState';
import { InvitationListItem, InvitationListItemSkeleton } from '@/components/InvitationListItem';
import { ScreenBackground } from '@/components/ScreenBackground';
import { Screen } from '@/components/Screen';
import { useAgency } from '@/hooks/useAgency';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useTheme } from '@/hooks/useTheme';
import { myInvitations } from '@/utils/invitations';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { events, hydrated, isOwner } = useEvents();
  const { resetDraft } = useEventDraft();
  const { tokens } = useTheme();
  const { isAgencyOwner } = useAgency();
  const { plans } = usePlanFeatures();

  const ownedEvents = events.filter((event) => isOwner(event));
  const invitations = myInvitations(events, isOwner);

  // plan_features.display_name is the single source of truth for a tier's
  // label (the exact same string the pricing screen's own card shows) —
  // looked up here rather than duplicated as a second set of tier-name
  // strings, so a card's badge can't drift from what the pricing screen
  // itself calls that plan. Falls back to the raw plan_tier value only if
  // plan_features doesn't (yet, or anymore) have a matching row.
  const planLabelFor = (planTier: string | null): string | null => {
    if (planTier === null) return null;
    return plans.find((plan) => plan.planKey === planTier)?.displayName ?? planTier;
  };

  const startCreating = () => {
    resetDraft();
    router.push('/create/type');
  };

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <Screen contentStyle={styles.content} transparent>
        <BrandHeader
          right={
            <TouchableOpacity
              style={[styles.profile, { backgroundColor: `${tokens.accentPrimary}22` }]}
              onPress={() => router.push('/profile')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Account"
            >
              <Feather name="settings" size={18} color={tokens.accentPrimary} />
            </TouchableOpacity>
          }
        />
        <Text style={[styles.tagline, { color: tokens.textSecondary }]}>{t('home.tagline')}</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}>
            {t('home.yourEvents')}
          </Text>
          <Text style={[styles.sectionHint, { color: tokens.textSecondary }]}>
            {t('home.yourEventsHint')}
          </Text>

          {!hydrated ? (
            <>
              <EventListItemSkeleton />
              <EventListItemSkeleton />
            </>
          ) : ownedEvents.length === 0 ? (
            <HomeEmptyState
              icon="calendar"
              headline={t('home.emptyEventsHeadline')}
              message={t('home.emptyEventsMessage')}
              ctaLabel={t('home.createEvent')}
              onPressCta={startCreating}
            />
          ) : (
            ownedEvents.map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                onPress={() => router.push(`/guest/${event.id}`)}
                planLabel={planLabelFor(event.planTier)}
                onPressChoosePlan={() => router.push(`/pricing/${event.id}`)}
              />
            ))
          )}
        </View>

        {/* Agency accounts don't participate in guest invitations — see
            CLAUDE.md's "Agency accounts" section. Hidden outright rather than
            just filtered to empty, since (unlike "Your events") there's no
            legitimate agency-owner invitation to ever show here. */}
        {isAgencyOwner ? null : (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: tokens.textSecondary }]}>
              {t('home.myInvitations')}
            </Text>
            <Text style={[styles.sectionHint, { color: tokens.textSecondary }]}>
              {t('home.myInvitationsHint')}
            </Text>

            {!hydrated ? (
              <>
                <InvitationListItemSkeleton />
                <InvitationListItemSkeleton />
              </>
            ) : invitations.length === 0 ? (
              <HomeEmptyState
                icon="mail"
                headline={t('home.emptyInvitationsHeadline')}
                message={t('home.emptyInvitationsMessage')}
              />
            ) : (
              invitations.map((invitation) => (
                <InvitationListItem
                  key={invitation.event.id}
                  invitation={invitation}
                  onPress={() =>
                    // Only a confirmed guest enters the event. Pending and
                    // declined both land on the RSVP screen, which for a
                    // declined guest shows no event-access button, only
                    // "Change my answer".
                    router.push(
                      invitation.guest.status === 'confirmed'
                        ? `/guest/${invitation.event.id}`
                        : `/invite/${invitation.event.id}`,
                    )
                  }
                />
              ))
            )}
          </View>
        )}
      </Screen>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: tokens.accentPrimary }]}
        onPress={startCreating}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Create an event"
      >
        <Feather name="plus" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: spacing.xxl,
    paddingTop: spacing.lg,
    // Clears the floating action button.
    paddingBottom: 96,
  },
  profile: {
    width: 38,
    height: 38,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 15,
    lineHeight: 21,
    marginTop: -spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: 13,
    marginTop: -spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
    width: 60,
    height: 60,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2B1A62',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
});
