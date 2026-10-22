import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';

import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { haptics } from '@/utils/haptics';
import { AVATAR_COLORS, AVATAR_INK, initials } from '@/utils/spontaneous';
import { themeRadius } from '@/utils/themeTokens';

/** The bordered card every spontaneous section sits in. */
export function SpCard({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        tokens.surfaceElevatedShadow ?? undefined,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Long-press → Delete (the app's long-press menu), same as moments and photos. */
export function DeletableRow({
  enabled,
  title,
  confirm,
  onDelete,
  children,
}: {
  enabled: boolean;
  title: string;
  /** Confirmation dialog first; omit for low-stakes rows. */
  confirm?: { title: string; message: string };
  onDelete: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={!enabled}
      onLongPress={() => {
        haptics.press();
        showActionSheet({
          title,
          actions: [
            {
              label: t('common.delete'),
              tone: 'delete',
              onPress: () => (confirm !== undefined ? confirmDelete(confirm.title, confirm.message, onDelete) : onDelete()),
            },
          ],
        });
      }}
    >
      {children}
    </TouchableOpacity>
  );
}

/** Small uppercase label, accent-colored ("WHO'S COMING"). */
export function Eyebrow({ children, right }: { children: string; right?: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.eyebrowRow}>
      <Text style={[styles.eyebrow, { color: tokens.accentText }]}>{children.toUpperCase()}</Text>
      {right !== undefined ? <Text style={[styles.eyebrowRight, { color: tokens.textSecondary }]}>{right}</Text> : null}
    </View>
  );
}

export function Avatar({ name, index, size = 34 }: { name: string; index: number; size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
          borderColor: tokens.surface,
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

/** Horizontal bar, `ratio` 0..1. */
export function Bar({ ratio, height = 8 }: { ratio: number; height?: number }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: tokens.surface2 }]}>
      <View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: tokens.accentFill,
          width: `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  eyebrowRight: {
    fontSize: 12.5,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: {
    fontWeight: '700',
    color: AVATAR_INK,
  },
  track: {
    overflow: 'hidden',
    borderRadius: themeRadius.pill,
  },
});
