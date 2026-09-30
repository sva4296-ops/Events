import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { useTheme } from '@/hooks/useTheme';

type FeatherName = keyof typeof Feather.glyphMap;

export interface SwipeAction {
  label: string;
  icon: FeatherName;
  tone: 'edit' | 'delete';
  onPress: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  actions: SwipeAction[];
  /** When false the row renders plainly — used to keep guests' rows static. */
  enabled?: boolean;
  containerStyle?: ViewStyle;
}

/**
 * Only one row may be open at a time, so opening a row closes the previous one.
 * Module-scoped because the rows are siblings across different lists.
 */
let openRow: SwipeableMethods | null = null;

export function closeOpenSwipeRow(): void {
  openRow?.close();
  openRow = null;
}

export function SwipeableRow({
  children,
  actions,
  enabled = true,
  containerStyle,
}: SwipeableRowProps) {
  const ref = useRef<SwipeableMethods>(null);
  const { tokens } = useTheme();
  // statusDeclined is a light rose in dark mode, so it takes dark text there.
  const labelColor = (tone: SwipeAction['tone']) =>
    tone === 'delete' ? (tokens.mode === 'dark' ? '#1E1A30' : '#FFFFFF') : tokens.onAccent;

  const handleWillOpen = useCallback(() => {
    if (openRow !== null && openRow !== ref.current) openRow.close();
    openRow = ref.current;
  }, []);

  const handleClose = useCallback(() => {
    if (openRow === ref.current) openRow = null;
  }, []);

  const runAction = useCallback((action: SwipeAction) => {
    // Close first so the row isn't left open behind a dialog or a new screen.
    ref.current?.close();
    openRow = null;
    action.onPress();
  }, []);

  if (!enabled || actions.length === 0) {
    return <>{children}</>;
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      rightThreshold={36}
      overshootRight={false}
      onSwipeableWillOpen={handleWillOpen}
      onSwipeableClose={handleClose}
      containerStyle={[styles.container, containerStyle]}
      renderRightActions={() => (
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[
                styles.action,
                { backgroundColor: action.tone === 'delete' ? tokens.statusDeclined : tokens.accentFill },
              ]}
              onPress={() => runAction(action)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <Feather name={action.icon} size={18} color={labelColor(action.tone)} />
              <Text style={[styles.label, { color: labelColor(action.tone) }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 22,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  action: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
