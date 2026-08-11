import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { closeOpenSwipeRow } from '@/components/SwipeableRow';
import { useTheme } from '@/hooks/useTheme';
import type { Gradient } from '@/types/event';
import { spacing } from '@/utils/theme';

interface ScreenProps {
  children: ReactNode;
  /** Fixed footer that stays below the scrollable content. */
  footer?: ReactNode;
  /** Defaults to the active theme's background wash — pass an explicit
   * gradient (e.g. an event type's colors) to override it, as invite/[id].tsx does. */
  gradient?: Gradient;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Skips the gradient so a ScreenBackground behind it shows through. */
  transparent?: boolean;
}

export function Screen({
  children,
  footer,
  gradient,
  scroll = true,
  contentStyle,
  transparent = false,
}: ScreenProps) {
  const { tokens } = useTheme();
  const Wrapper = transparent ? TransparentWrapper : LinearGradient;
  const resolvedGradient = gradient ?? tokens.background;

  return (
    <Wrapper colors={resolvedGradient} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={closeOpenSwipeRow}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.fill, styles.content, contentStyle]}>{children}</View>
        )}
        {footer !== undefined ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </Wrapper>
  );
}

/** Same props shape as LinearGradient so the two are interchangeable above. */
function TransparentWrapper({
  children,
  style,
}: {
  colors?: Gradient;
  style?: ViewStyle;
  children: ReactNode;
}) {
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
