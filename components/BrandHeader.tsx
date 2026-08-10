import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { brand, fonts } from '@/utils/guestTheme';

interface BrandHeaderProps {
  /** Wordmark size; the mark scales with it. */
  size?: 'sm' | 'md';
  /** Rendered at the far right, e.g. the profile button on Home. */
  right?: ReactNode;
}

/**
 * The single wordmark treatment for the whole app — mark, navy "Povestea",
 * purple "Noastra". Change it here and every screen follows.
 */
export function BrandHeader({ size = 'md', right }: BrandHeaderProps) {
  const small = size === 'sm';

  return (
    <View style={styles.row}>
      <BrandMark width={small ? 28 : 36} strokeWidth={small ? 14 : 12} />
      <Text style={[styles.wordmark, small && styles.wordmarkSmall]}>
        Povestea<Text style={styles.accent}>Noastra</Text>
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
    color: brand.navy,
  },
  wordmarkSmall: {
    fontSize: 19,
  },
  accent: {
    color: brand.purple,
  },
  right: {
    marginLeft: 'auto',
  },
});
