import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { guest, gRadius, gSpace } from '@/utils/guestTheme';

/** The one empty-state treatment used everywhere: soft card, centered muted text. */
export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.message}>{message}</Text>
      {action !== undefined ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    paddingVertical: gSpace.xxl,
    paddingHorizontal: gSpace.xl,
    alignItems: 'center',
    gap: gSpace.lg,
    borderWidth: 1,
    borderColor: guest.line,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: guest.body,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
  },
});
