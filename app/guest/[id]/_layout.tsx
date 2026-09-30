import Feather from '@expo/vector-icons/Feather';
import { router, Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';

import { EventHeaderBar, type HeaderAction } from '@/components/guest/EventHeaderBar';
import { currentStage } from '@/components/StoryTimeline';
import { useEventContent } from '@/hooks/useEventContent';
import { useTheme } from '@/hooks/useTheme';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';
import { daysUntilEvent, formatShortDate } from '@/utils/format';
import { floatingTabBar, guest, gRadius } from '@/utils/guestTheme';

type FeatherName = keyof typeof Feather.glyphMap;

const TABS: readonly { name: string; label: string; icon: FeatherName }[] = [
  { name: 'index', label: 'Acasă', icon: 'home' },
  { name: 'detalii', label: 'Detalii', icon: 'list' },
  { name: 'fond', label: 'Fond', icon: 'gift' },
  { name: 'chat', label: 'Chat', icon: 'message-circle' },
  { name: 'live', label: 'Live', icon: 'radio' },
  { name: 'album', label: 'Album', icon: 'image' },
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
  const { getEvent, hydrated, isOwner } = useEvents();
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
  const stageKeys = ['onboarding.stageLaunch', 'onboarding.stageJourney', 'onboarding.stageDayX', 'onboarding.stageRecap'] as const;
  const headerSubtitle =
    event !== undefined
      ? `${formatShortDate(event.date)} · ${t(stageKeys[currentStage(daysUntilEvent(event.date))] ?? stageKeys[1])}`
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
    } else if (activeTab === 'fond' && content !== null && content.fund !== null) {
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
          name={event?.name ?? 'Evenimentul nostru'}
          type={event?.type ?? null}
          subtitle={headerSubtitle}
          showBack={activeTab === 'acasa'}
          actions={actions}
        />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: [
              styles.bar,
              {
                backgroundColor: tokens.tabBar.background,
                borderTopColor: tokens.border,
                height: floatingTabBar.height + insets.bottom,
                paddingBottom: insets.bottom,
              },
            ],
            tabBarActiveTintColor: tokens.tabBar.active,
            tabBarInactiveTintColor: tokens.tabBar.inactive,
            tabBarItemStyle: styles.item,
            sceneStyle: { backgroundColor: 'transparent' },
          }}
        >
          {TABS.map((tab) => (
            <Tabs.Screen
              key={tab.name}
              name={tab.name}
              options={{
                title: tab.label,
                tabBarLabel: ({ color, focused }) => (
                  <Text style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>
                    {tab.label}
                  </Text>
                ),
                // Warm Story 2.0: accentTint pill behind the active icon.
                tabBarIcon: ({ color, focused }) => (
                  <View style={[styles.iconWrap, focused && { backgroundColor: tokens.accentTint }]}>
                    <Feather name={tab.icon} size={21} color={color} />
                  </View>
                ),
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
  // with `insets.bottom + floatingTabBar.gap + floatingTabBar.height`.
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
  label: {
    fontSize: 11,
    marginTop: 3,
  },
  iconWrap: {
    width: 48,
    height: 30,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
