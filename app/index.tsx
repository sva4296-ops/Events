import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BrandHeader } from '@/components/BrandHeader';
import { EventListItem } from '@/components/EventListItem';
import { HomeEmptyState } from '@/components/HomeEmptyState';
import { InvitationListItem } from '@/components/InvitationListItem';
import { ScreenBackground } from '@/components/ScreenBackground';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useEventDraft } from '@/hooks/useEventDraft';
import { useEvents } from '@/hooks/useEvents';
import { myInvitations } from '@/utils/invitations';
import { colors, radius, shadow, spacing } from '@/utils/theme';

export default function DashboardScreen() {
  const { mode } = useAuth();
  const { events, hydrated, isOwner } = useEvents();
  const { resetDraft } = useEventDraft();

  // Signed in, only events that carry an owner are real user data. Anything left
  // on this device from a pre-auth build is ignored rather than shown as theirs.
  const visibleEvents =
    mode === 'supabase' ? events.filter((event) => event.owner_id !== undefined) : events;

  const ownedEvents = visibleEvents.filter((event) => isOwner(event));
  const invitations = myInvitations(visibleEvents, isOwner, mode);

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
              style={styles.profile}
              onPress={() => router.push('/profile')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Account"
            >
              <Feather name="user" size={18} color={colors.primary} />
            </TouchableOpacity>
          }
        />
        <Text style={styles.tagline}>More than an invitation — the whole story.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your events</Text>
          <Text style={styles.sectionHint}>Events you host.</Text>

          {!hydrated ? null : ownedEvents.length === 0 ? (
            <HomeEmptyState
              icon="calendar"
              headline="Start your first story"
              message="Create a page for your event and invite the people who matter."
              ctaLabel="Create event"
              onPressCta={startCreating}
            />
          ) : (
            ownedEvents.map((event) => (
              <EventListItem
                key={event.id}
                event={event}
                onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
              />
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My invitations</Text>
          <Text style={styles.sectionHint}>Events you were invited to.</Text>

          {!hydrated ? null : invitations.length === 0 ? (
            <HomeEmptyState
              icon="mail"
              headline="No invitations yet"
              message="When someone invites you, it shows up here."
            />
          ) : (
            invitations.map((invitation) => (
              <InvitationListItem
                key={invitation.event.id}
                invitation={invitation}
                onPress={() =>
                  router.push(
                    invitation.guest.status === 'pending'
                      ? `/invite/${invitation.event.id}`
                      : `/guest/${invitation.event.id}`,
                  )
                }
              />
            ))
          )}
        </View>
      </Screen>

      <TouchableOpacity
        style={styles.fab}
        onPress={startCreating}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Create an event"
      >
        <Feather name="plus" size={26} color={colors.onPrimary} />
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
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.muted,
    marginTop: -spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.faint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: -spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowOpacity: 0.22,
  },
});
