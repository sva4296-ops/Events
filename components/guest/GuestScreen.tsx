import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { CoverStatusContext, EventChromeContext } from '@/components/guest/eventChrome';
import { EventAccentProvider, useTheme } from '@/hooks/useTheme';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';

interface GuestScreenProps {
  /** Draws the event's cover hero on top: Acasă only. */
  showHero?: boolean;
  children?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Only for screens without EventHeaderBar above them — it owns the top inset. */
  topInset?: boolean;
  /** Skips the solid cream fill so a ScreenBackground behind it shows through. */
  transparent?: boolean;
  /** Screens opened from an event (outside the tabs): its cover theme's accent (null = the app's). */
  coverTheme?: string | null;
}

export function GuestScreen({
  children,
  scroll = true,
  contentStyle,
  topInset = false,
  transparent = false,
  coverTheme = null,
  showHero = false,
}: GuestScreenProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  // The floating tabs bar is `position: 'absolute'` (see app/guest/[id]/_layout.tsx),
  // so it no longer reserves layout space automatically — every guest screen's own
  // scroll content has to clear it manually. Harmless overshoot on the one GuestScreen
  // consumer outside the tabs (checkout/[id].tsx, a stub with no floating bar above it).
  const padding = {
    paddingTop: (topInset ? insets.top : 0) + gSpace.lg,
    paddingBottom: tabBarBottomInset(insets.bottom) + floatingTabBar.gap + floatingTabBar.height + gSpace.lg,
  };
  const pageStyle = styles.pageTransparent;

  const [heroBottom, setHeroBottom] = useState<number | null>(null);
  const [pastHero, setPastHero] = useState(false);
  const chrome = useContext(EventChromeContext);
  const coverStatus = useMemo(
    () => ({
      reportHeroBottom: setHeroBottom,
      onScrollY: (y: number) => setPastHero(heroBottom !== null && y > heroBottom - insets.top),
    }),
    [heroBottom, insets.top],
  );
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const body = !scroll ? (
    <View style={[pageStyle, padding, contentStyle]}>{children}</View>
  ) : (
    <ScrollView
      style={pageStyle}
      contentContainerStyle={[styles.content, padding, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={64}
      onScroll={(event) => coverStatus.onScrollY(event.nativeEvent.contentOffset.y)}
    >
      {showHero ? chrome?.hero : null}
      {children}
    </ScrollView>
  );

  return (
    <EventAccentProvider coverTheme={coverTheme}>
      <CoverStatusContext.Provider value={coverStatus}>
      {heroBottom !== null && !pastHero && focused ? <StatusBar style="light" /> : null}
      {transparent ? (
        body
      ) : (
        <View style={[styles.page, { backgroundColor: tokens.background[0] }]}>
          <AmbientBackground />
          {body}
        </View>
      )}
      </CoverStatusContext.Provider>
    </EventAccentProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  pageTransparent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: gSpace.xxl,
    gap: gSpace.lg,
  },
});
