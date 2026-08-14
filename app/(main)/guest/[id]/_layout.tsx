import Feather from '@expo/vector-icons/Feather';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventHeaderBar } from '@/components/guest/EventHeaderBar';
import { EventTopMenu } from '@/components/guest/EventTopMenu';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { floatingTabBar, guest, gRadius, gSpace } from '@/utils/guestTheme';

type FeatherName = keyof typeof Feather.glyphMap;

// Exported so EventTopMenu (web-only top nav) can render the exact same
// six destinations, icons, and labels as the native bottom bar below —
// one list, not two that could drift apart.
export const TABS: readonly { name: string; label: string; icon: FeatherName }[] = [
  { name: 'index', label: 'Acasă', icon: 'home' },
  { name: 'detalii', label: 'Detalii', icon: 'file-text' },
  { name: 'fond', label: 'Fond', icon: 'heart' },
  { name: 'chat', label: 'Chat', icon: 'message-circle' },
  { name: 'live', label: 'Live', icon: 'camera' },
  { name: 'album', label: 'Album', icon: 'image' },
];

export default function GuestEventLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, hydrated, isOwner } = useEvents();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();

  if (!hydrated || id === undefined) {
    return <View style={[styles.blank, { backgroundColor: tokens.background[0] }]} />;
  }

  const event = getEvent(id);

  const tabsElement = (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Web's own bar is hidden — EventTopMenu (top nav, web-only, see
        // below) is the real navigation there. The underlying <Tabs>
        // navigator is unchanged either way, only its own default bar is
        // hidden here so it doesn't render twice.
        tabBarStyle:
          Platform.OS === 'web'
            ? styles.hiddenBar
            : [
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
                style={[styles.iconWrap, focused && { backgroundColor: tokens.accentPrimary }]}
              >
                <Feather name={tab.icon} size={focused ? 22 : 20} color={color} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );

  const owner = event !== undefined && isOwner(event);

  return (
    // `key={id}` forces a full remount of everything below (including the
    // nested <Tabs> navigator) whenever the event changes. Without it, on
    // web — where switching events is a <Slot/> re-render at the same tree
    // position, not a Stack push like on native — React reuses this same
    // subtree instance across events. <Tabs>'s own internal "loaded tabs"
    // state is keyed by each Tabs.Screen's static `name` (e.g. "detalii"),
    // never by this `id`, so a tab already loaded for one event stays
    // loaded — stale — when a different event mounts into the same spot.
    // Native is unaffected: a Stack push already creates a fresh screen
    // instance per event, so this key never actually changes within one.
    <GuestEventProvider id={id} key={id}>
      <View style={[styles.shell, { backgroundColor: tokens.background[0] }]}>
        <ScreenBackground />
        {Platform.OS === 'web' ? (
          // Single merged top menu on web — no back arrow (the events list
          // is always visible in the master-detail left pane, see
          // app/(main)/_layout.tsx, so there's nothing to "go back" to) and
          // no separate sidebar; content is full-width below it.
          <EventTopMenu name={event?.name ?? 'Evenimentul nostru'} id={id} owner={owner} />
        ) : (
          <EventHeaderBar
            name={event?.name ?? 'Evenimentul nostru'}
            id={id}
            showManage={owner}
          />
        )}
        {tabsElement}
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
  hiddenBar: {
    display: 'none',
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
