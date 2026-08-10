import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { closeOpenSwipeRow } from '@/components/SwipeableRow';
import { guest, gSpace } from '@/utils/guestTheme';

interface GuestScreenProps {
  children?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Only for screens without EventHeaderBar above them — it owns the top inset. */
  topInset?: boolean;
  /** Skips the solid cream fill so a ScreenBackground behind it shows through. */
  transparent?: boolean;
}

export function GuestScreen({
  children,
  scroll = true,
  contentStyle,
  topInset = false,
  transparent = false,
}: GuestScreenProps) {
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: (topInset ? insets.top : 0) + gSpace.lg };
  const pageStyle = transparent ? styles.pageTransparent : styles.page;

  if (!scroll) {
    return <View style={[pageStyle, padding, contentStyle]}>{children}</View>;
  }

  return (
    <ScrollView
      style={pageStyle}
      contentContainerStyle={[styles.content, padding, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Scrolling dismisses any revealed swipe actions, as on iOS.
      onScrollBeginDrag={closeOpenSwipeRow}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: guest.cream,
  },
  pageTransparent: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: gSpace.xl,
    paddingBottom: gSpace.xxl,
    gap: gSpace.lg,
  },
});
