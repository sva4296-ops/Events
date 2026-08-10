import { StyleSheet, Text } from 'react-native';

import { guest } from '@/utils/guestTheme';

/** Small uppercase eyebrow above each section. */
export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: guest.faint,
  },
});
