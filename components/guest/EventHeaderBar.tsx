import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, guest, gRadius, gSpace } from '@/utils/guestTheme';

/**
 * Persistent header for the guest event tabs. Lives in the tabs layout so every
 * tab gets it, and back always lands on Home rather than the previous tab.
 */
export function EventHeaderBar({ name, mark = '✦' }: { name: string; mark?: string }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + gSpace.md }]}>
      <TouchableOpacity
        style={styles.back}
        onPress={() => router.navigate('/')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Înapoi la ecranul principal"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="chevron-left" size={22} color={guest.ink} />
      </TouchableOpacity>

      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>

      <View style={styles.mark}>
        <Text style={styles.markText}>{mark}</Text>
      </View>
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
  back: {
    width: 38,
    height: 38,
    borderRadius: gRadius.pill,
    backgroundColor: guest.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flex: 1,
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: guest.ink,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    backgroundColor: guest.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 14,
    color: guest.purple,
  },
});
