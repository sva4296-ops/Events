import Feather from '@expo/vector-icons/Feather';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EventHeaderBar } from '@/components/guest/EventHeaderBar';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { GuestEventProvider } from '@/hooks/useGuestEvent';
import { useEvents } from '@/hooks/useEvents';
import { guest, gRadius } from '@/utils/guestTheme';

type FeatherName = keyof typeof Feather.glyphMap;

const TABS: readonly { name: string; label: string; icon: FeatherName }[] = [
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

  if (!hydrated || id === undefined) {
    return <View style={[styles.blank, { backgroundColor: tokens.background[0] }]} />;
  }

  const event = getEvent(id);

  return (
    <GuestEventProvider id={id}>
      <View style={[styles.shell, { backgroundColor: tokens.background[0] }]}>
        <ScreenBackground />
        <EventHeaderBar
          name={event?.name ?? 'Evenimentul nostru'}
          id={id}
          showManage={event !== undefined && isOwner(event)}
        />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: [styles.bar, { backgroundColor: tokens.tabBar.background }],
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
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    height: 96,
    paddingTop: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -5 },
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
