import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * Full-screen "working on it" overlay (e.g. "Se șterge…") shown while a
 * promise runs. Imperative like the action sheet: runWithBusy() from anywhere,
 * BusyOverlayHost is mounted once in app/_layout.tsx. Blocks touches so
 * nothing is tapped twice mid-delete.
 */

/** Fast operations finish before this and never flash the overlay. */
const SHOW_AFTER_MS = 150;

let present: ((label: string | null) => void) | null = null;
let running = 0;

export async function runWithBusy<T>(work: Promise<T>, label: string): Promise<T> {
  running += 1;
  const timer = setTimeout(() => present?.(label), SHOW_AFTER_MS);
  try {
    return await work;
  } finally {
    clearTimeout(timer);
    running -= 1;
    if (running === 0) present?.(null);
  }
}

export function BusyOverlayHost() {
  const { tokens } = useTheme();
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    present = setLabel;
    return () => {
      present = null;
    };
  }, []);

  if (label === null) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(120)}
      style={[StyleSheet.absoluteFill, styles.backdrop]}
      accessibilityViewIsModal
    >
      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <ActivityIndicator size="small" color={tokens.accentText} />
        <Text style={[styles.label, { color: tokens.textPrimary }]} accessibilityLiveRegion="polite">
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(16, 12, 28, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: themeRadius.lg,
    borderWidth: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
