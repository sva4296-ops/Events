import { Redirect, router, Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import { EventHeaderBar, type HeaderAction } from '@/components/guest/EventHeaderBar';
import { TabBarIcon, type TabIconId } from '@/components/guest/TabBarIcon';
import { GettingStartedSheet, openGettingStarted } from '@/components/tour/GettingStartedSheet';
import { currentStage, stageDayKey } from '@/components/StoryTimeline';
import { useChatRead } from '@/hooks/useChatRead';
import { useEventContent } from '@/hooks/useEventContent';
import { EventAccentProvider, useTheme } from '@/hooks/useTheme';
import { eventAccentTokens } from '@/utils/eventAccent';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';
import { FUND_ENABLED } from '@/utils/features';
import { daysUntilEvent, formatShortDate, isEventPast } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { floatingTabBar, guest, tabBarBottomInset } from '@/utils/guestTheme';

const TABS: readonly { name: string; labelKey: string; icon: TabIconId }[] = [
  { name: 'index', labelKey: 'guestTabs.home', icon: 'home' },
  { name: 'detalii', labelKey: 'guestTabs.details', icon: 'plan' },
  { name: 'fond', labelKey: 'guestTabs.fund', icon: 'fund' },
  { name: 'chat', labelKey: 'guestTabs.chat', icon: 'chat' },
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

/** Derived from the pathname rather than the tab bar's own state, since this
 * bar is mounted once above <Tabs> and needs to know which tab is active. */
type ActiveTab = 'acasa' | 'detalii' | 'fond' | 'chat' | 'live' | 'album';

function getActiveTab(pathname: string): ActiveTab {
  if (pathname.endsWith('/detalii')) return 'detalii';
  if (pathname.endsWith('/fond')) return 'fond';
  if (pathname.endsWith('/chat')) return 'chat';
  if (pathname.endsWith('/live')) return 'live';
  if (pathname.endsWith('/album')) return 'album';
  return 'acasa';
}

export default function GuestEventLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, hydrated, isOwner, isPrimaryOwner, isRestaurant } = useEvents();
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { content, deleteFund } = useEventContent(id ?? '');
  const { hasUnread } = useChatRead(id ?? '');

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
  const headerSubtitle =
    event !== undefined
      ? `${formatShortDate(event.date)} · ${t(
          ['onboarding.stageLaunch', 'onboarding.stageJourney', stageDayKey(event.type), 'onboarding.stageRecap'][
            currentStage(daysUntilEvent(event.date))
          ] ?? 'onboarding.stageJourney',
        )}`
      : undefined;

  // Which single-row top-right action(s) show depends on the active tab —
  // guests/stats only on Acasă (the guest list's one entry point, see §4 of
  // CLAUDE.md), and the fund's own
  // edit+delete only on Fond (and only once a fund actually exists — an
  // empty Fond tab has nothing to edit or delete). Every other tab gets none.
  const actions: HeaderAction[] = [];
  // Finished events get no header actions: deleting one is a long press on
  // its Home card, like every other event.
  if (!past && owner) {
    if (activeTab === 'acasa' && venueEvent) {
      // A venue night: its bookings instead of the wedding-shaped guide.
      actions.push({
        key: 'bookings',
        icon: 'clipboard',
        accessibilityLabel: t('venue.bookings.title'),
        onPress: () => router.push(`/venue-bookings/${id}`),
      });
    } else if (activeTab === 'acasa') {
      actions.push({
        key: 'help',
        icon: 'help-circle',
        accessibilityLabel: t('gettingStarted.title'),
        onPress: openGettingStarted,
      });
      actions.push({
        key: 'guests',
        icon: 'users',
        accessibilityLabel: 'Lista de invitați și statistici',
        onPress: () => router.push(`/event/${id}`),
      });
      // Straight to the event editor (name, date, place, co-organizers),
      // instead of the long press on its Home card.
      actions.push({
        key: 'edit-event',
        icon: 'edit-2',
        accessibilityLabel: t('event.editEvent'),
        onPress: () => router.push(`/edit-event/${id}`),
      });
    } else if (activeTab === 'detalii' && venueEvent) {
      // The Book tab replaces the Detalii hub: the programme and the event
      // editor are reached from here instead.
      actions.push(
        {
          key: 'programme',
          icon: 'clock',
          accessibilityLabel: t('venue.tabs.editProgramme'),
          onPress: () => router.push(`/detalii-schedule/${id}`),
        },
        {
          key: 'edit-event',
          icon: 'edit-2',
          accessibilityLabel: t('event.editEvent'),
          onPress: () => router.push(`/edit-event/${id}`),
        },
      );
    } else if (activeTab === 'detalii' && spontaneous) {
      // The spontaneous Plan tab has no Detalii hub to reach the event editor from.
      actions.push({
        key: 'edit-event',
        icon: 'edit-2',
        accessibilityLabel: t('event.editEvent'),
        onPress: () => router.push(`/edit-event/${id}`),
      });
    } else if (activeTab === 'fond' && spontaneous) {
      actions.push({
        key: 'edit-bill',
        icon: 'edit-2',
        accessibilityLabel: t('spontaneous.bill.edit'),
        onPress: () => router.push(`/bill/${id}`),
      });
    } else if (activeTab === 'fond' && isPrimaryOwner(event) && content !== null && content.fund !== null) {
      const fund = content.fund;
      const contributorCount = content.contributions.length;
      actions.push(
        {
          key: 'edit-fund',
          icon: 'edit-2',
          accessibilityLabel: 'Editează fondul',
          onPress: () => router.push(`/fund/${id}`),
        },
        {
          key: 'delete-fund',
          icon: 'trash-2',
          tone: 'destructive',
          accessibilityLabel: 'Șterge fondul',
          onPress: () => {
            const message =
              contributorCount > 0
                ? t('fond.deleteFundWithContributions', { title: fund.title, count: contributorCount })
                : t('fond.deleteFundNoContributions', { title: fund.title });
            confirmDelete(t('fond.deleteFundTitle'), message, deleteFund);
          },
        },
      );
    }
  }

  return (
    <GuestEventProvider id={id}>
      <EventAccentProvider coverTheme={event?.coverTheme ?? null}>
      <LinearGradient colors={tokens.background} style={styles.shell}>
        <EventHeaderBar
          // Name and date only on Acasă; the other tabs keep just their actions.
          name={activeTab === 'acasa' || restaurant ? (event?.name ?? 'Evenimentul nostru') : ''}
          type={event?.type ?? null}
          // Acasă shows just the name: the date and stage live in the countdown card below.
          subtitle={restaurant ? headerSubtitle : undefined}
          showBack={activeTab === 'acasa' || restaurant}
          actions={actions}
        />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: [
              restaurant && styles.hidden,
              styles.bar,
              {
                backgroundColor: tokens.tabBar.background,
                borderColor: tokens.border,
                borderTopColor: tokens.border,
                height: floatingTabBar.height,
                bottom: tabBarBottomInset(insets.bottom),
                shadowOpacity: tokens.mode === 'dark' ? 0.45 : 0.16,
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
  // Floating pill above the bottom edge. `position: 'absolute'` so screens
  // scroll under it; every guest screen clears it with
  // `tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height`.
  // borderTopWidth is set explicitly: React Navigation's own top border
  // otherwise stays under a custom style.
  bar: {
    position: 'absolute',
    // Margins, not left/right offsets: React Navigation's tab bar overrides
    // left/right, and the pill came out full width.
    left: 0,
    right: 0,
    marginHorizontal: floatingTabBar.side,
    borderRadius: 32,
    borderWidth: 1,
    borderTopWidth: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 6,
    shadowColor: '#000000',
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
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
