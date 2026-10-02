import Feather from '@expo/vector-icons/Feather';
import { Redirect, router, Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import { EventHeaderBar, type HeaderAction } from '@/components/guest/EventHeaderBar';
import { TabBarIcon } from '@/components/guest/TabBarIcon';
import { currentStage, stageDayKey } from '@/components/StoryTimeline';
import { useEventContent } from '@/hooks/useEventContent';
import { useTheme } from '@/hooks/useTheme';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';
import { daysUntilEvent, formatShortDate } from '@/utils/format';
import { haptics } from '@/utils/haptics';
import { floatingTabBar, guest, tabBarBottomInset } from '@/utils/guestTheme';

type FeatherName = keyof typeof Feather.glyphMap;

const TABS: readonly { name: string; labelKey: string; icon: FeatherName }[] = [
  { name: 'index', labelKey: 'guestTabs.home', icon: 'home' },
  { name: 'detalii', labelKey: 'guestTabs.details', icon: 'list' },
  { name: 'fond', labelKey: 'guestTabs.fund', icon: 'gift' },
  { name: 'chat', labelKey: 'guestTabs.chat', icon: 'message-circle' },
  { name: 'live', labelKey: 'guestTabs.live', icon: 'radio' },
  { name: 'album', labelKey: 'guestTabs.album', icon: 'image' },
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
  // CLAUDE.md), the edit-event pencil only on Detalii, and the fund's own
  // edit+delete only on Fond (and only once a fund actually exists — an
  // empty Fond tab has nothing to edit or delete). Every other tab gets none.
  const actions: HeaderAction[] = [];
  if (owner) {
    if (activeTab === 'acasa') {
      actions.push({
        key: 'guests',
        icon: 'users',
        accessibilityLabel: 'Lista de invitați și statistici',
        onPress: () => router.push(`/event/${id}`),
      });
    } else if (activeTab === 'detalii') {
      actions.push({
        key: 'edit-event',
        icon: 'edit-2',
        accessibilityLabel: t('event.editEvent'),
        onPress: () => router.push(`/edit-event/${id}`),
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
      <LinearGradient colors={tokens.background} style={styles.shell}>
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
                borderTopColor: tokens.border,
                height: floatingTabBar.height + tabBarBottomInset(insets.bottom),
                paddingBottom: tabBarBottomInset(insets.bottom),
              },
            ],
            tabBarActiveTintColor: tokens.tabBar.active,
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
                title: t(tab.labelKey),
                tabBarLabel: ({ color, focused }) => (
                  <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>
                    {t(tab.labelKey)}
                  </Text>
                ),
                // Warm Story 2.0: accentTint pill behind the active icon.
                tabBarIcon: ({ color, focused }) => <TabBarIcon name={tab.icon} color={color} focused={focused} />,
              }}
            />
          ))}
        </Tabs>
      </LinearGradient>
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
  // Docked to the bottom edge (Warm Story 2.0). Still `position: 'absolute'`
  // so screens scroll under the translucent bar; every guest screen clears it
  // with `tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height`.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 6,
    elevation: 0,
    shadowOpacity: 0,
  },
  item: {
    paddingTop: 2,
  },
  hidden: {
    display: 'none',
  },
  label: {
    fontSize: 11,
    marginTop: 3,
  },
});
