import Feather from '@expo/vector-icons/Feather';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type EventMenuAction } from '@/components/EventMenu';
import { DashboardHero, DashboardHeroSkeleton, DashboardRow } from '@/components/DashboardCards';
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
import { useChatActivity } from '@/hooks/useChatActivity';
import { useUnreadChats } from '@/hooks/useUnreadChats';
import { useTheme } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import i18n from '@/utils/i18n';
import { compareEventsByDate } from '@/utils/eventOrder';
import { confirmDelete } from '@/utils/confirm';
import { isEventPast } from '@/utils/format';
import { reportSupabaseError } from '@/utils/reportError';
import { myInvitations } from '@/utils/invitations';
import { staggerIn } from '@/utils/motion';
import { canOpenEventPage } from '@/utils/spontaneous';
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
  useChatActivity();
  const { unreadFor, refetch: refetchUnread } = useUnreadChats();
  // Back on Home (e.g. after reading a chat): refresh the "new messages" pills.
  useFocusEffect(
    useCallback(() => {
      refetchUnread();
    }, [refetchUnread]),
  );
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { events, hydrated, isOwner, isPrimaryOwner, isRestaurant, deleteEvent } = useEvents();
  const { resetDraft } = useEventDraft();
  const { tokens } = useTheme();
  const { isAgencyOwner } = useAgency();
  const { firstName, lastName, avatarUrl } = useUserProfile();
  const { user } = useAuth();

  // The restaurant's events sit here too (labelled), never under invitations:
  // RLS shows it the whole guest list, so guests[0] wouldn't be "its" row.
  const managesEvent = (event: (typeof events)[number]) => isOwner(event) || isRestaurant(event);
  const ownedEvents = events.filter(managesEvent).sort(compareEventsByDate);
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

  // Edit (until it's over) and, for its creator, Delete after a confirmation:
  // a bottom sheet on a long press of the card.
  const menuFor = (event: (typeof events)[number]): EventMenuAction[] => {
    if (isRestaurant(event)) return [];
    const actions: EventMenuAction[] = [];
    if (isOwner(event) && !isEventPast(event.date)) {
      actions.push({
        id: 'edit',
        title: t('common.edit'),
        onPress: () => router.push(`/edit-event/${event.id}`),
      });
    }
    if (isPrimaryOwner(event)) {
      actions.push({
        id: 'delete',
        title: t('common.delete'),
        destructive: true,
        onPress: () =>
          confirmDelete(
            t('editEventForm.deleteTitle'),
            t('editEventForm.deleteBody', { name: event.name }),
            () => deleteEvent(event.id).catch(reportSupabaseError),
          ),
      });
    }
    return actions;
  };

  // The restaurant only has the Detalii tab; everyone else lands on Acasă.
  const openEvent = (event: (typeof events)[number]) =>
    router.push(isRestaurant(event) ? `/guest/${event.id}/detalii` : `/guest/${event.id}`);

  const startCreating = () => {
    resetDraft();
    router.push('/create/type');
  };

  return (
    <View style={styles.root}>
      {/* Cards scroll all the way down, behind the floating "create" button
          and the home indicator; the padding keeps the last one reachable. */}
      <Screen
        bottomSafeArea={false}
        contentStyle={{ ...styles.content, paddingBottom: styles.content.paddingBottom + insets.bottom }}
      >
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text style={[styles.date, { color: tokens.textSecondary }]}>{todayLabel()}</Text>
            <Text style={[styles.hello, { color: tokens.textPrimary, fontFamily: tokens.displayFont }]} numberOfLines={1}>
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
            <DashboardHeroSkeleton />
          ) : ownedEvents.length === 0 ? (
            <HomeEmptyState
              icon="calendar"
              headline={t('home.emptyEventsHeadline')}
              message={t('home.emptyEventsMessage')}
              ctaLabel={t('home.createEvent')}
              onPressCta={startCreating}
            />
          ) : (
            <>
              {/* The soonest event gets the big card; the rest are compact rows. */}
              <Animated.View entering={staggerIn(0)}>
                <DashboardHero
                  event={ownedEvents[0]!}
                  onPress={() => openEvent(ownedEvents[0]!)}
                  menuActions={menuFor(ownedEvents[0]!)}
                  onPressInvite={() => router.push(`/event/${ownedEvents[0]!.id}`)}
                />
              </Animated.View>
              {ownedEvents.length > 1 ? (
                <View>
                  <Text style={[styles.overline, { color: tokens.textSecondary, borderBottomColor: tokens.border }]}>
                    {t('home.dashboard.upNext')}
                  </Text>
                  {ownedEvents.slice(1).map((event, index) => (
                    <Animated.View key={event.id} entering={staggerIn(index + 1)}>
                      <DashboardRow
                        event={event}
                        showDivider={index > 0}
                        onPress={() => openEvent(event)}
                        menuActions={menuFor(event)}
                      />
                    </Animated.View>
                  ))}
                </View>
              ) : null}
            </>
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
                      unreadMessages={invitation.guest.status === 'confirmed' ? unreadFor(invitation.event.id) : 0}
                      onPress={() =>
                        // Only a confirmed guest enters the event (or "maybe", on a
                        // spontaneous one). Pending and declined both land on
                        // the RSVP screen, which for a declined guest shows no
                        // event-access button, only "Change my answer".
                        router.push(
                          canOpenEventPage(invitation.event.type, invitation.guest.status)
                            ? `/guest/${invitation.event.id}`
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

      <TouchableOpacity
        onPress={startCreating}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('home.createEvent')}
        style={[styles.fab, { backgroundColor: tokens.accentFill, bottom: Math.max(insets.bottom, spacing.md) + 8 }]}
      >
        <Feather name="plus" size={26} color={tokens.onAccent} />
      </TouchableOpacity>
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
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
    paddingVertical: 4,
  },
  tabText: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
    flexShrink: 1,
  },
  tabCount: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 14,
    opacity: 0.7,
    flexShrink: 1,
  },
  sectionTitle: {
    ...typography.subtitle,
    fontSize: 18,
  },
  overline: {
    fontFamily: typeface.bodySemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
