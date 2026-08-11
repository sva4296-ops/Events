import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/** Small uppercase eyebrow above each section. */
export function SectionLabel({ children }: { children: string }) {
  const { tokens } = useTheme();
  return <Text style={[styles.label, { color: tokens.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
});
