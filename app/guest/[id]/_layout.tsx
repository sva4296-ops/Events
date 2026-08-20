import Feather from '@expo/vector-icons/Feather';
import { router, Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventHeaderBar, type HeaderAction } from '@/components/guest/EventHeaderBar';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useEventContent } from '@/hooks/useEventContent';
import { useTheme } from '@/hooks/useTheme';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { confirmDelete } from '@/utils/confirm';
import { floatingTabBar, guest, gRadius, gSpace } from '@/utils/guestTheme';

type FeatherName = keyof typeof Feather.glyphMap;

const TABS: readonly { name: string; label: string; icon: FeatherName }[] = [
  { name: 'index', label: 'Acasă', icon: 'home' },
  { name: 'detalii', label: 'Detalii', icon: 'file-text' },
  { name: 'fond', label: 'Fond', icon: 'heart' },
  { name: 'chat', label: 'Chat', icon: 'message-circle' },
  { name: 'live', label: 'Live', icon: 'camera' },
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
      <View style={[styles.shell, { backgroundColor: tokens.background[0] }]}>
        <ScreenBackground />
        <EventHeaderBar
          name={event?.name ?? 'Evenimentul nostru'}
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
                bottom: insets.bottom + floatingTabBar.gap,
                shadowOpacity: tokens.mode === 'dark' ? 0.4 : 0.18,
              },
            ],
            tabBarActiveTintColor: tokens.tabBar.active,
            tabBarInactiveTintColor: tokens.tabBar.inactive,
            tabBarLabelStyle: styles.label,
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
                // Solid accent pill behind the active icon (gold icon on top,
                // per the Warm Story tab bar spec); muted outline when not.
                tabBarIcon: ({ color, focused }) => (
                  <View
                    style={[
                      styles.iconWrap,
                      focused && { backgroundColor: tokens.accentPrimary },
                    ]}
                  >
                    <Feather name={tab.icon} size={focused ? 22 : 20} color={color} />
                  </View>
                ),
              }}
            />
          ))}
        </Tabs>
      </View>
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
  // Floating pill, not edge-to-edge: `position: 'absolute'` so the exact
  // recipe React Navigation's own docs use for a floating tab bar — taking it
  // out of the default automatic-safe-area/height computation entirely,
  // rather than fighting that computation with a margin on a normal-flow
  // sibling (that's what produced the double-counted gap and the stray
  // default hairline border in the previous attempt: `borderTopWidth: 0`
  // below explicitly cancels react-navigation's own default border, which
  // omitting the property does not — an unset key in a merged style array
  // doesn't override a value the library's own base style already set).
  // `bottom` is set inline (needs the device's actual safe-area inset).
  bar: {
    position: 'absolute',
    // Matches GuestScreen's/EventHeaderBar's own paddingHorizontal (gSpace.xl)
    // so the bar's edges line up with card/section edges above it, rather
    // than an arbitrary margin unique to the tab bar.
    left: gSpace.xl,
    right: gSpace.xl,
    borderRadius: 20,
    borderTopWidth: 0,
    height: floatingTabBar.height,
    marginHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  item: {
    paddingTop: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
  },
  iconWrap: {
    minWidth: 52,
    height: 34,
    paddingHorizontal: 16,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
