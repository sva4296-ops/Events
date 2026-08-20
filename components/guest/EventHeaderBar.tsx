import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { fonts, gRadius, gSpace } from '@/utils/guestTheme';

type FeatherName = keyof typeof Feather.glyphMap;

export interface HeaderAction {
  key: string;
  icon: FeatherName;
  accessibilityLabel: string;
  onPress: () => void;
  /** Recolors the icon to the destructive tone — same circular button otherwise. */
  tone?: 'default' | 'destructive';
}

interface EventHeaderBarProps {
  name: string;
  /** Only Acasă is the exit point back to the main events list — the other
   * five tabs are already reachable via the bottom tab bar within this same
   * event, so a back arrow there would (incorrectly) suggest leaving the
   * event entirely. Decided per-tab by the tabs layout, not by this component. */
  showBack?: boolean;
  /** Top-right, one row alongside the back button — which action(s) show here
   * (guests/stats on Acasă, edit on Detalii, edit+delete on Fond, none
   * elsewhere) is decided per-tab by the tabs layout, not by this component. */
  actions?: HeaderAction[];
}

/**
 * Persistent header for the guest event tabs. Lives in the tabs layout so every
 * tab gets it. The back arrow (when shown) always lands on Home rather than the
 * previous tab — tab-to-tab navigation is the bottom tab bar's job, not this bar's.
 */
export function EventHeaderBar({ name, showBack = false, actions = [] }: EventHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + gSpace.md }]}>
      {showBack ? (
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: tokens.surfaceElevated }]}
          onPress={() => router.navigate('/')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Înapoi la ecranul principal"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="chevron-left" size={22} color={tokens.textPrimary} />
        </TouchableOpacity>
      ) : null}

      <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
        {name}
      </Text>

      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.iconButton, { backgroundColor: tokens.surfaceElevated }]}
              onPress={action.onPress}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={action.icon}
                size={20}
                color={action.tone === 'destructive' ? tokens.destructive : tokens.textPrimary}
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
    paddingHorizontal: gSpace.xl,
    paddingBottom: gSpace.md,
    backgroundColor: 'transparent',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: gSpace.sm,
  },
});
