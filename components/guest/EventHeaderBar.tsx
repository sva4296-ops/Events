import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { fonts, gRadius, gSpace } from '@/utils/guestTheme';

interface EventHeaderBarProps {
  name: string;
  /** Needed only to link to the manage screen — see `showManage`. */
  id?: string;
  /** Owner-only: shows a guest-list/stats icon that opens the dashboard
   * (`event/[id]`), the screen's only entry point since Home now opens
   * straight into Acasă for owned events. */
  showManage?: boolean;
}

/**
 * Persistent header for the guest event tabs. Lives in the tabs layout so every
 * tab gets it, and back always lands on Home rather than the previous tab.
 */
export function EventHeaderBar({ name, id, showManage = false }: EventHeaderBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + gSpace.md }]}>
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

      <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
        {name}
      </Text>

      {showManage && id !== undefined ? (
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: tokens.surfaceElevated }]}
          onPress={() => router.push(`/event/${id}`)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Lista de invitați și statistici"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="users" size={20} color={tokens.textPrimary} />
        </TouchableOpacity>
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
});
