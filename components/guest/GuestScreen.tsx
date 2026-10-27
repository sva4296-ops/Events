import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventAccentProvider, useTheme } from '@/hooks/useTheme';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';

interface GuestScreenProps {
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
  const pageStyle = transparent
    ? styles.pageTransparent
    : [styles.page, { backgroundColor: tokens.background[0] }];

  const body = !scroll ? (
    <View style={[pageStyle, padding, contentStyle]}>{children}</View>
  ) : (
    <ScrollView
      style={pageStyle}
      contentContainerStyle={[styles.content, padding, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

  return <EventAccentProvider coverTheme={coverTheme}>{body}</EventAccentProvider>;
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
