import { Redirect, router, Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import { EventCoverBackground } from '@/components/EventCoverBackground';
import { EventHeaderBar, type HeaderAction } from '@/components/guest/EventHeaderBar';
import { TabBarIcon, type TabIconId } from '@/components/guest/TabBarIcon';
import { GettingStartedSheet, openGettingStarted } from '@/components/tour/GettingStartedSheet';
import { currentStage, stageDayKey } from '@/components/StoryTimeline';
import { useChatRead } from '@/hooks/useChatRead';
import { useEventContent } from '@/hooks/useEventContent';
import { EventAccentProvider, useTheme } from '@/hooks/useTheme';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';
import { eventAccentTokens } from '@/utils/eventAccent';
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
  if (!FUND_ENABLED && activeTab === 'fond') {
    return <Redirect href={`/guest/${id}`} />;
  }
  // Finished events keep only Acasă and Album; any other tab lands on Acasă.
  if (past && activeTab !== 'acasa' && activeTab !== 'album') {
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
    if (activeTab === 'acasa') {
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
      <EventAccentProvider type={event?.type ?? null}>
      <LinearGradient colors={tokens.background} style={styles.shell}>
        {/* The type's cover photo behind every tab, full screen, under a veil of
            the page background so the header, chat and cards stay readable. */}
        {event !== undefined ? <EventCoverBackground type={event.type} /> : null}
        <EventHeaderBar
          // Name and date only on Acasă; the other tabs keep just their actions.
          name={activeTab === 'acasa' || restaurant ? (event?.name ?? 'Evenimentul nostru') : ''}
          type={event?.type ?? null}
          subtitle={activeTab === 'acasa' || restaurant ? headerSubtitle : undefined}
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
            tabBarActiveTintColor:
              event !== undefined ? eventAccentTokens(event.type, tokens).tabBar.active : tokens.tabBar.active,
            tabBarInactiveTintColor: tokens.tabBar.inactive,
            tabBarItemStyle: styles.item,
            sceneStyle: { backgroundColor: 'transparent' },
          }}
          screenListeners={{ tabPress: () => haptics.tap() }}
        >
          {TABS.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                // Past events hide every tab but Acasă and Album.
                href:
                  (past && tab.name !== 'index' && tab.name !== 'album') || (!FUND_ENABLED && tab.name === 'fond')
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
          ))}
        </Tabs>
        {!past && owner && !restaurant ? <GettingStartedSheet eventId={id} /> : null}
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
