import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { showActionSheet } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { EventListItem, EventListItemSkeleton } from '@/components/EventListItem';
import { GeneratedAvatar } from '@/components/GeneratedAvatar';
import { HomeEmptyState } from '@/components/HomeEmptyState';
import {
  InvitationGroup,
  InvitationListItem,
  InvitationListItemSkeleton,
} from '@/components/InvitationListItem';
import { Screen } from '@/components/Screen';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAgency } from '@/hooks/useAgency';
import { useAuth } from '@/hooks/useAuth';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { usePlanFeatures } from '@/hooks/usePlanFeatures';
import { useTheme } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import i18n from '@/utils/i18n';
import { compareEventsByDate } from '@/utils/eventOrder';
import { confirmDelete } from '@/utils/confirm';
import { isEventPast } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { reportSupabaseError } from '@/utils/reportError';
import { myInvitations } from '@/utils/invitations';
import { staggerIn } from '@/utils/motion';
import { spacing } from '@/utils/theme';
import { themeRadius, typeface, typography } from '@/utils/themeTokens';

type HomeTab = 'mine' | 'invited' | 'all';

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
  usePushNotifications();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { events, hydrated, isOwner, isPrimaryOwner, isRestaurant, myCoOrganizerRole, deleteEvent } = useEvents();
  const { resetDraft } = useEventDraft();
  const { tokens } = useTheme();
  const { isAgencyOwner } = useAgency();
  const { plans } = usePlanFeatures();
  const { firstName, lastName, avatarUrl } = useUserProfile();
  const { user } = useAuth();

  // The restaurant's events sit here too (labelled), never under invitations:
  // RLS shows it the whole guest list, so guests[0] wouldn't be "its" row.
  const managesEvent = (event: (typeof events)[number]) => isOwner(event) || isRestaurant(event);
  const ownedEvents = events.filter(managesEvent).sort(compareEventsByDate);
  // Null for events you own; your label ("Naș", "Mireasă"…) where you're a co-organizer.
  const coOrganizerLabel = (role: ReturnType<typeof myCoOrganizerRole>) =>
    role === null ? null : role === 'co_organizer' ? t('home.coOrganizer') : t(`coOrganizers.relation.${role}`);
  const invitations = myInvitations(events, managesEvent).sort((a, b) => compareEventsByDate(a.event, b.event));
  const avatarInitials = initials(firstName, lastName);

  // Null = not picked yet: open on "mine", or on "invited" when you only
  // have invitations. Agency accounts never get invitations, so no tabs.
  const [pickedTab, setPickedTab] = useState<HomeTab | null>(null);
  const tab: HomeTab = isAgencyOwner
    ? 'mine'
    : (pickedTab ?? (ownedEvents.length === 0 && invitations.length > 0 ? 'invited' : 'mine'));
  const showMine = tab !== 'invited';
  const showInvited = !isAgencyOwner && tab !== 'mine';
  const tabs: { key: HomeTab; label: string; count: number | null }[] = [
    { key: 'mine', label: t('home.yourEvents'), count: hydrated ? ownedEvents.length : null },
    { key: 'invited', label: t('home.tabInvited'), count: hydrated ? invitations.length : null },
    { key: 'all', label: t('home.tabAll'), count: null },
  ];

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

  // Long press on one of your event cards: edit it (until it's over) and, for
  // its creator, delete it after a confirmation. Replaces Detalii's pencil.
  const openEventMenu = (event: (typeof events)[number]) => {
    const canEdit = isOwner(event) && !isEventPast(event.date);
    const canDelete = isPrimaryOwner(event);
    if (!canEdit && !canDelete) return;
    haptics.press();
    showActionSheet({
      title: event.name,
      actions: [
        ...(canEdit
          ? [{ label: t('common.edit'), tone: 'edit' as const, onPress: () => router.push(`/edit-event/${event.id}`) }]
          : []),
        ...(canDelete
          ? [
              {
                label: t('common.delete'),
                tone: 'delete' as const,
                onPress: () =>
                  confirmDelete(
                    t('editEventForm.deleteTitle'),
                    t('editEventForm.deleteBody', { name: event.name }),
                    () => {
                      deleteEvent(event.id).catch(reportSupabaseError);
                    },
                  ),
              },
            ]
          : []),
      ],
    });
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
              <GeneratedAvatar seed={user?.id ?? avatarInitials} size={44} />
            )}
          </TouchableOpacity>
        </View>

        {isAgencyOwner ? null : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
            accessibilityRole="tablist"
          >
            {tabs.map((item) => {
              const active = tab === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setPickedTab(item.key)}
                  activeOpacity={0.8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.tab,
                    active
                      ? { backgroundColor: tokens.textPrimary }
                      : { backgroundColor: tokens.surface, borderWidth: 1.5, borderColor: tokens.border },
                  ]}
                >
                  <Text style={[styles.tabText, { color: active ? tokens.surface : tokens.textPrimary }]}>
                    {item.label}
                  </Text>
                  {item.count !== null ? (
                    <Text style={[styles.tabCount, { color: active ? tokens.surface : tokens.textPrimary }]}>
                      {item.count}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {showMine ? (
        <View style={styles.section}>
          {tab === 'all' ? (
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>{t('home.yourEvents')}</Text>
          ) : null}

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
            ownedEvents.map((event, index) => (
              <Animated.View key={event.id} entering={staggerIn(index)}>
                <EventListItem
                  event={event}
                  onPress={() =>
                    // The restaurant only has the Detalii tab.
                    // A finished event opens on its album (the only thing left to do there).
                    router.push(
                      isRestaurant(event)
                        ? `/guest/${event.id}/detalii`
                        : isEventPast(event.date)
                          ? `/guest/${event.id}/album`
                          : `/guest/${event.id}`,
                    )
                  }
                  planLabel={planLabelFor(event.planTier)}
                  onPressChoosePlan={() => router.push(`/pricing/${event.id}`)}
                  coOrganizerLabel={coOrganizerLabel(myCoOrganizerRole(event))}
                  onLongPress={isRestaurant(event) ? undefined : () => openEventMenu(event)}
                />
              </Animated.View>
            ))
          )}
        </View>
        ) : null}

        {/* Agency accounts don't participate in guest invitations — see
            CLAUDE.md's "Agency accounts" section. Hidden outright rather than
            just filtered to empty, since (unlike "Your events") there's no
            legitimate agency-owner invitation to ever show here. */}
        {!showInvited ? null : (
          <View style={styles.section}>
            {tab === 'all' ? (
              <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
                {t('home.myInvitations')}
              </Text>
            ) : null}

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
                  <Animated.View key={invitation.event.id} entering={staggerIn(index)}>
                    <InvitationListItem
                      invitation={invitation}
                      showDivider={index > 0}
                      onPress={() =>
                        // Only a confirmed guest enters the event. Pending and
                        // declined both land on the RSVP screen, which for a
                        // declined guest shows no event-access button, only
                        // "Change my answer".
                        router.push(
                          invitation.guest.status === 'confirmed'
                            ? isEventPast(invitation.event.date)
                              ? `/guest/${invitation.event.id}/album`
                              : `/guest/${invitation.event.id}`
                            : `/invite/${invitation.event.id}`,
                        )
                      }
                    />
                  </Animated.View>
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
    fontFamily: typeface.bodyMedium,
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
    fontFamily: typeface.bodyBold,
    fontSize: 15,
  },
  section: {
    gap: spacing.md,
  },
  tabs: {
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
  },
  tabText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
  },
  tabCount: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
    opacity: 0.7,
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
