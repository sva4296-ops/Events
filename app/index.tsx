import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { EventListItem, EventListItemSkeleton } from '@/components/EventListItem';
import { HomeEmptyState } from '@/components/HomeEmptyState';
import {
  InvitationGroup,
  InvitationListItem,
  InvitationListItemSkeleton,
} from '@/components/InvitationListItem';
import { Screen } from '@/components/Screen';
import { useAgency } from '@/hooks/useAgency';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useTheme } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import i18n from '@/utils/i18n';
import { myInvitations } from '@/utils/invitations';
import { spacing } from '@/utils/theme';
import { brandGradient, themeRadius, typography } from '@/utils/themeTokens';

function todayLabel(): string {
  const label = new Date().toLocaleDateString(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function initials(firstName: string | null, lastName: string | null): string {
  const letters = `${firstName?.trim().charAt(0) ?? ''}${lastName?.trim().charAt(0) ?? ''}`;
  return letters.toUpperCase();
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { events, hydrated, isOwner } = useEvents();
  const { resetDraft } = useEventDraft();
  const { tokens } = useTheme();
  const { isAgencyOwner } = useAgency();
  const { plans } = usePlanFeatures();
  const { firstName, lastName, avatarUrl } = useUserProfile();

  const ownedEvents = events.filter((event) => isOwner(event));
  const invitations = myInvitations(events, isOwner);
  const avatarInitials = initials(firstName, lastName);

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
      <Screen contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text style={[styles.date, { color: tokens.textSecondary }]}>{todayLabel()}</Text>
            <Text style={[styles.hello, { color: tokens.textPrimary }]} numberOfLines={1}>
              {firstName !== null && firstName.trim().length > 0
                ? t('home.greeting', { name: firstName.trim() })
                : t('home.greetingNoName')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/profile')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('home.profile')}
          >
            {avatarUrl !== null ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.avatar}
              >
                {avatarInitials.length > 0 ? (
                  <Text style={styles.avatarText}>{avatarInitials}</Text>
                ) : (
                  <Feather name="user" size={20} color="#FFFFFF" />
                )}
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('home.yourEvents')}</Text>

          {!hydrated ? (
            <EventListItemSkeleton />
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
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
              {t('home.myInvitations')}
            </Text>

            {!hydrated ? (
              <InvitationGroup>
                <InvitationListItemSkeleton />
                <InvitationListItemSkeleton showDivider />
              </InvitationGroup>
            ) : invitations.length === 0 ? (
              <HomeEmptyState
                icon="mail"
                headline={t('home.emptyInvitationsHeadline')}
                message={t('home.emptyInvitationsMessage')}
              />
            ) : (
              <InvitationGroup>
                {invitations.map((invitation, index) => (
                  <InvitationListItem
                    key={invitation.event.id}
                    invitation={invitation}
                    showDivider={index > 0}
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
                ))}
              </InvitationGroup>
            )}
          </View>
        )}
      </Screen>

      <View style={[styles.createBar, { bottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
        <Button
          label={t('home.createEvent')}
          onPress={startCreating}
          icon={<Feather name="plus" size={20} color={tokens.onAccent} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    gap: spacing.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: 20,
    // Clears the floating "create" button.
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greeting: {
    flex: 1,
    gap: 2,
  },
  date: {
    fontSize: 14,
  },
  hello: {
    ...typography.title1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    fontSize: 18,
  },
  createBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
