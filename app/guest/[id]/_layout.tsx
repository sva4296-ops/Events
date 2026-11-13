import { Redirect, router, Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import { AmbientBackground } from '@/components/AmbientBackground';

import { EventChromeContext } from '@/components/guest/eventChrome';
import { EventHero } from '@/components/guest/EventHero';
import { EventHeaderBar, type HeaderAction } from '@/components/guest/EventHeaderBar';
import { TabBarIcon, type TabIconId } from '@/components/guest/TabBarIcon';
import { GettingStartedSheet } from '@/components/tour/GettingStartedSheet';
import { currentStage, stageDayKey } from '@/components/StoryTimeline';
import { useChatRead } from '@/hooks/useChatRead';
import { useEventContent } from '@/hooks/useEventContent';
import { EventAccentProvider, useTheme } from '@/hooks/useTheme';
import { eventAccentTokens } from '@/utils/eventAccent';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { useKickWhenRemoved } from '@/hooks/useKickWhenRemoved';
import { FUND_ENABLED } from '@/utils/features';
import { daysUntilEvent, formatShortDate, isEventPast } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { floatingTabBar, guest, tabBarBottomInset } from '@/utils/guestTheme';

/** Derived from the pathname rather than the tab bar's own state, since this
 * bar is mounted once above <Tabs> and needs to know which tab is active. */
type ActiveTab = 'acasa' | 'detalii' | 'fond' | 'invitati' | 'chat' | 'live' | 'album';

const TABS: readonly { name: string; labelKey: string; icon: TabIconId }[] = [
  { name: 'index', labelKey: 'guestTabs.home', icon: 'home' },
  { name: 'detalii', labelKey: 'guestTabs.details', icon: 'plan' },
  { name: 'fond', labelKey: 'guestTabs.fund', icon: 'fund' },
  { name: 'invitati', labelKey: 'guestTabs.guests', icon: 'guests' },
  { name: 'chat', labelKey: 'guestTabs.chat', icon: 'chat' },
  // Not in the bar anymore; the route stays for the live stream's old links.
  { name: 'live', labelKey: 'guestTabs.live', icon: 'live' },
  { name: 'album', labelKey: 'guestTabs.album', icon: 'album' },
];

/** Spontaneous events: Detalii is the Plan, Fond is the bill split. */
const SPONTANEOUS_TAB_OVERRIDES: Record<string, { labelKey: string; icon: TabIconId }> = {
  detalii: { labelKey: 'guestTabs.plan', icon: 'plan' },
  fond: { labelKey: 'guestTabs.bill', icon: 'bill' },
};

/** Venue nights: Acasă is Tonight, Detalii is Book, Fond is the Ticket. */
const VENUE_TAB_OVERRIDES: Record<string, { labelKey: string; icon: TabIconId }> = {
  index: { labelKey: 'guestTabs.tonight', icon: 'tonight' },
  detalii: { labelKey: 'guestTabs.book', icon: 'book' },
  fond: { labelKey: 'guestTabs.ticket', icon: 'ticket' },
};

function getActiveTab(pathname: string): ActiveTab {
  if (pathname.endsWith('/detalii')) return 'detalii';
  if (pathname.endsWith('/fond')) return 'fond';
  if (pathname.endsWith('/invitati')) return 'invitati';
  if (pathname.endsWith('/chat')) return 'chat';
  if (pathname.endsWith('/live')) return 'live';
  if (pathname.endsWith('/album')) return 'album';
  return 'acasa';
}

export default function GuestEventLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, hydrated, isOwner, isRestaurant } = useEvents();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { content } = useEventContent(id ?? '');
  const { hasUnread } = useChatRead(id ?? '');
  useKickWhenRemoved(id === undefined ? undefined : getEvent(id), hydrated);

  if (!hydrated || id === undefined) {
    return <View style={[styles.blank, { backgroundColor: tokens.background[0] }]} />;
  }

  const event = getEvent(id);
  const owner = isOwner(event);
  const spontaneous = event?.type === 'spontaneous';
  const venueEvent = event?.type === 'venue';
  const activeTab = getActiveTab(pathname);
  // The restaurant gets only Detalii (venue, menu, seating): no tab bar, and
  // any other tab (e.g. a push opening /guest/<id>) lands back on Detalii.
  const restaurant = isRestaurant(event);
  if (restaurant && activeTab !== 'detalii') {
    return <Redirect href={`/guest/${id}/detalii`} />;
  }
  // A finished event is an archive: only Acasă (its moments) and the Album
  // stay; no guest list, details, fund, chat or live, and nothing to edit.
  const past = event !== undefined && !restaurant && isEventPast(event.date);
  // Fund hidden for now (utils/features.ts): an old link to it lands on Acasă.
  // A spontaneous event's Fond tab is the bill split, not the fund, so it stays.
  // Spontaneous (bill split) and venue (ticket) nights reuse the Fond tab for something else.
  if (!FUND_ENABLED && !spontaneous && !venueEvent && activeTab === 'fond') {
    return <Redirect href={`/guest/${id}`} />;
  }
  // Finished events keep only Acasă and Album; any other tab lands on Acasă.
  // A spontaneous event's bill is usually settled after the night, so it stays too.
  if (past && activeTab !== 'acasa' && activeTab !== 'album' && !(spontaneous && activeTab === 'fond')) {
    return <Redirect href={`/guest/${id}`} />;
  }
  // The guest list is the organizers' (a guest's RLS only returns their own
  // row); a venue night has its bookings instead.
  const guestsTab = owner && !venueEvent;
  if (!guestsTab && activeTab === 'invitati') {
    return <Redirect href={`/guest/${id}`} />;
  }
  const headerSubtitle =
    event !== undefined
      ? `${formatShortDate(event.date)} · ${t(
          ['onboarding.stageLaunch', 'onboarding.stageJourney', stageDayKey(event.type), 'onboarding.stageRecap'][
            currentStage(daysUntilEvent(event.date))
          ] ?? 'onboarding.stageJourney',
        )}`
      : undefined;

  // Only Acasă has the cover (and its back and edit); what's specific to another tab goes in a slim bar.
  const headerActions: HeaderAction[] =
    past || !owner
      ? []
      : activeTab === 'detalii' && venueEvent
        ? [
            {
              key: 'programme',
              icon: 'clock',
              accessibilityLabel: t('venue.tabs.editProgramme'),
              onPress: () => router.push(`/detalii-schedule/${id}`),
            },
          ]
        : activeTab === 'fond' && spontaneous
          ? [
              {
                key: 'edit-bill',
                icon: 'edit-3',
                accessibilityLabel: t('spontaneous.bill.edit'),
                onPress: () => router.push(`/bill/${id}`),
              },
            ]
          : [];

  const chrome =
    event === undefined || restaurant
      ? null
      : {
          hero: <EventHero event={event} canEdit={owner && !past} />,
        };

  return (
    <GuestEventProvider id={id}>
      <EventAccentProvider coverTheme={event?.coverTheme ?? null}>
      <LinearGradient colors={tokens.background} style={styles.shell}>
        <AmbientBackground />
        {restaurant ? (
          <EventHeaderBar
            name={event?.name ?? 'Evenimentul nostru'}
            type={event?.type ?? null}
            subtitle={headerSubtitle}
            showBack
            actions={[]}
          />
        ) : activeTab === 'acasa' ? null : headerActions.length > 0 ? (
          <EventHeaderBar name="" type={event?.type ?? null} actions={headerActions} />
        ) : (
          <View style={{ height: insets.top }} />
        )}
        <EventChromeContext.Provider value={chrome}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarStyle: [
                restaurant && styles.hidden,
                styles.bar,
                {
                  backgroundColor: tokens.tabBar.background,
                  borderTopColor: tokens.border,
                  // Docked and opaque: the bar itself covers the system nav area.
                  height: floatingTabBar.height + tabBarBottomInset(insets.bottom),
                  paddingBottom: tabBarBottomInset(insets.bottom),
                },
              ],
              // This component reads the theme outside its own EventAccentProvider.
              tabBarActiveTintColor: eventAccentTokens(event?.coverTheme, tokens)?.tabBar.active ?? tokens.tabBar.active,
              tabBarInactiveTintColor: tokens.tabBar.inactive,
              tabBarItemStyle: styles.item,
              sceneStyle: { backgroundColor: 'transparent' },
            }}
            screenListeners={{ tabPress: () => haptics.tap() }}
          >
            {TABS.map((base) => {
              const tab = {
                ...base,
                ...(spontaneous ? SPONTANEOUS_TAB_OVERRIDES[base.name] : undefined),
                ...(venueEvent ? VENUE_TAB_OVERRIDES[base.name] : undefined),
              };
              return (
                <Tabs.Screen
                  key={tab.name}
                  name={tab.name}
                  options={{
                    // Past events hide every tab but Acasă and Album. The bill
                    // split (spontaneous Fond) isn't the fund, so FUND_ENABLED
                    // doesn't hide it.
                    href:
                      tab.name === 'live' ||
                      (tab.name === 'invitati' && !guestsTab) ||
                      (past && tab.name !== 'index' && tab.name !== 'album' && !(spontaneous && tab.name === 'fond')) ||
                      (!FUND_ENABLED && !spontaneous && !venueEvent && tab.name === 'fond')
                        ? null
                        : undefined,
                    title: t(tab.labelKey),
                    tabBarLabel: ({ color, focused }) => (
                      <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>
                        {t(tab.labelKey)}
                      </Text>
                    ),
                    // Warm Story 2.0: accentTint pill behind the active icon.
                    tabBarIcon: ({ color, focused }) => (
                      <TabBarIcon
                        name={tab.icon}
                        color={color}
                        focused={focused}
                        badge={tab.name === 'chat' && !focused && content !== null && hasUnread(content.messages)}
                      />
                    ),
                  }}
                />
              );
            })}
          </Tabs>
        </EventChromeContext.Provider>
        {!past && owner && !restaurant && !venueEvent ? <GettingStartedSheet eventId={id} /> : null}
      </LinearGradient>
      </EventAccentProvider>
    </GuestEventProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: guest.cream,
  },
  blank: {
    flex: 1,
    backgroundColor: guest.cream,
  },
  // Docked to the bottom edge. `position: 'absolute'` so screens scroll under it;
  // every guest screen clears it with
  // `tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height`.
  // borderTopWidth is set explicitly: React Navigation's own top border
  // otherwise stays under a custom style.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 0,
    paddingHorizontal: 6,
    elevation: 0,
  },
  item: {
    paddingTop: 8,
    paddingBottom: 6,
    justifyContent: 'center',
  },
  hidden: {
    display: 'none',
  },
  label: {
    fontSize: 11,
    marginTop: 3,
  },
});
