import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * The one empty-state treatment used everywhere: soft card, centered muted
 * text. `icon` is optional (default: none, unchanged for every existing
 * caller) — pass it for a state that isn't just "nothing here yet" but
 * "you can't do this right now," e.g. a plan-gated feature (`icon="lock"`,
 * see hooks/usePlanGate.tsx and its callers).
 */
export function EmptyState({
  message,
  action,
  icon,
}: {
  message: string;
  action?: ReactNode;
  icon?: FeatherName;
}) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {icon !== undefined ? (
        <View style={[styles.iconWrap, { backgroundColor: `${tokens.statusPending}1A` }]}>
          <Feather name={icon} size={20} color={tokens.statusPending} />
        </View>
      ) : null}
      <Text style={[styles.message, { color: tokens.textSecondary }]}>{message}</Text>
      {action !== undefined ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.lg,
    paddingVertical: gSpace.xxl,
    paddingHorizontal: gSpace.xl,
    alignItems: 'center',
    gap: gSpace.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  action: {
    alignSelf: 'stretch',
  },
});
