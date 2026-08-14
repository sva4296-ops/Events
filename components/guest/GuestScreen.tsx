import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { closeOpenSwipeRow } from '@/components/SwipeableRow';
import { useTheme } from '@/hooks/useTheme';
import { floatingTabBar, gSpace } from '@/utils/guestTheme';

interface GuestScreenProps {
  children?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Only for screens without EventHeaderBar above them — it owns the top inset. */
  topInset?: boolean;
  /** Skips the solid cream fill so a ScreenBackground behind it shows through. */
  transparent?: boolean;
  /**
   * Web only — caps the content column at this width and centers it, instead
   * of letting it stretch edge-to-edge across a wide browser window. Ignored
   * on native (and on web when omitted), where the column fills the device
   * width exactly as before. See utils/webLayout.ts for the two standard
   * widths screens pass here.
   */
  webMaxWidth?: number;
}

export function GuestScreen({
  children,
  scroll = true,
  contentStyle,
  topInset = false,
  transparent = false,
  webMaxWidth,
}: GuestScreenProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  // The floating tabs bar is `position: 'absolute'` (see app/guest/[id]/_layout.tsx),
  // so it no longer reserves layout space automatically — every guest screen's own
  // scroll content has to clear it manually. Harmless overshoot on the one GuestScreen
  // consumer outside the tabs (checkout/[id].tsx, a stub with no floating bar above it).
  // On web, that bar is hidden in favor of EventTopMenu (a normal-flow top
  // menu, not absolute), so there's no floating bar to clear there — just
  // the usual safe-area/breathing-room padding.
  const padding = {
    paddingTop: (topInset ? insets.top : 0) + gSpace.lg,
    paddingBottom:
      Platform.OS === 'web'
        ? insets.bottom + gSpace.lg
        : insets.bottom + floatingTabBar.gap + floatingTabBar.height + gSpace.lg,
  };
  const pageStyle = transparent
    ? styles.pageTransparent
    : [styles.page, { backgroundColor: tokens.background[0] }];

  const capWidth = Platform.OS === 'web' && webMaxWidth !== undefined;
  // `width: '100%'` + `maxWidth` + the parent's `alignItems: 'center'` (below)
  // is the standard responsive-centered-column recipe: below the cap the
  // column still fills its parent exactly like the uncapped case, above it
  // the maxWidth clamps it and centering takes over — no behavior change on
  // native or on an unset/narrow web window.
  const innerCapStyle = capWidth ? { maxWidth: webMaxWidth, width: '100%' as const } : null;

  if (!scroll) {
    if (!capWidth) {
      return <View style={[pageStyle, padding, contentStyle]}>{children}</View>;
    }
    return (
      <View style={[pageStyle, padding, contentStyle, styles.webCenter]}>
        <View style={innerCapStyle}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={pageStyle}
      contentContainerStyle={[padding, contentStyle, capWidth && styles.webCenter]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Scrolling dismisses any revealed swipe actions, as on iOS.
      onScrollBeginDrag={closeOpenSwipeRow}
    >
      <View style={[styles.content, innerCapStyle]}>{children}</View>
    </ScrollView>
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
    paddingHorizontal: gSpace.xl,
    gap: gSpace.lg,
  },
  webCenter: {
    alignItems: 'center',
  },
});
