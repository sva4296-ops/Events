import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { useTheme } from '@/hooks/useTheme';
import { fonts } from '@/utils/guestTheme';

interface BrandHeaderProps {
  /** Wordmark size; the mark scales with it. */
  size?: 'sm' | 'md';
  /** Rendered at the far right, e.g. the profile button on Home. */
  right?: ReactNode;
}

/**
 * The single wordmark treatment for the whole app — mark, "Povestea" in the
 * primary text color, "Noastra" in the accent. Change it here and every
 * screen follows. Theme-aware so it stays legible on both the light cream
 * wash and the dark navy-purple wash.
 */
export function BrandHeader({ size = 'md', right }: BrandHeaderProps) {
  const { tokens } = useTheme();
  const small = size === 'sm';

  return (
    <View style={styles.row}>
      <BrandMark width={small ? 28 : 36} strokeWidth={small ? 14 : 12} />
      <Text style={[styles.wordmark, small && styles.wordmarkSmall, { color: tokens.textPrimary }]}>
        Povestea<Text style={{ color: tokens.accentPrimary }}>Noastra</Text>
      </Text>
      {right !== undefined ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontFamily: fonts.displayBold,
    fontSize: 24,
  },
  wordmarkSmall: {
    fontSize: 19,
  },
  right: {
    marginLeft: 'auto',
  },
});
