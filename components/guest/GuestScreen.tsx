import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventCoverBackground } from '@/components/EventCoverBackground';
import { EventAccentProvider, useTheme } from '@/hooks/useTheme';
import type { EventTypeId } from '@/types/event';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';

interface GuestScreenProps {
  children?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Only for screens without EventHeaderBar above them — it owns the top inset. */
  topInset?: boolean;
  /** Skips the solid cream fill so a ScreenBackground behind it shows through. */
  transparent?: boolean;
  /** Screens opened from an event (outside the tabs): its type's cover behind the content. */
  coverType?: EventTypeId | null;
}

export function GuestScreen({
  children,
  scroll = true,
  contentStyle,
  topInset = false,
  transparent = false,
  coverType = null,
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
  const pageStyle = transparent || coverType !== null
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

  if (coverType === null) return body;

  return (
    <View style={[styles.page, { backgroundColor: tokens.background[0] }]}>
      <EventCoverBackground type={coverType} />
      <EventAccentProvider type={coverType}>{body}</EventAccentProvider>
    </View>
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
