import { Slot, Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { EventsListPane } from '@/components/EventsListPane';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';

/**
 * Groups Home (`index`) and the guest event pages (`guest/[id]/...`) under
 * one shared layout — a route group (`(main)`), invisible in the URL, so
 * every existing `router.push('/guest/${id}')`/`Link href="/"` call site
 * elsewhere in the app keeps resolving exactly as before; only what wraps
 * these two routes changes.
 *
 * Native: a plain `<Stack>`, functionally identical to how the root Stack
 * already handled these two routes before this pass — same push/pop, same
 * gesture-back. This is genuinely just one level of nesting deeper, not a
 * behavior change; the root `app/_layout.tsx` Stack now sees `(main)` as a
 * single entry instead of `index`/`guest` as two flat siblings, functioning
 * the same way its other flat siblings (`/profile`, `/create/*`, etc.) do.
 *
 * Web: a real master-detail layout instead of full-page navigation — the
 * events list (`EventsListPane`) is a persistent left pane; the right pane
 * is a `<Slot/>`, rendering whichever child route currently matches (the
 * "select an event" placeholder at `/`, or the full guest event — header +
 * sidebar + tab content, unchanged from the previous pass — at
 * `/guest/{id}/...`). Selecting an event is still a real `router.push`, so
 * the URL, back/forward, and bookmarking a specific event all keep working;
 * only the *visual* result of that navigation differs from native, same as
 * the sidebar/topbar shell work before it.
 */
export default function MainLayout() {
  const { tokens } = useTheme();

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webShell, { backgroundColor: tokens.background[0] }]}>
        <ScreenBackground />
        <View style={styles.webListPane}>
          <EventsListPane />
        </View>
        <View
          style={[styles.webDetailPane, { borderLeftColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)' }]}
        >
          <Slot />
        </View>
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  webShell: {
    flex: 1,
    flexDirection: 'row',
  },
  webListPane: {
    width: 420,
  },
  webDetailPane: {
    flex: 1,
    borderLeftWidth: 1,
  },
});
