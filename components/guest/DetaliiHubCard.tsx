import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { StatusDot } from '@/components/guest/StatusDot';
import { useTheme } from '@/hooks/useTheme';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';

type FeatherName = keyof typeof Feather.glyphMap;

interface DetaliiHubCardProps {
  icon: FeatherName;
  title: string;
  status: string;
  /** Drives the at-a-glance `StatusDot` — whether this section has any data
   * set yet. The status text stays the detail; the dot is the quick signal,
   * same visible to owner and guest alike (this screen has no owner-only
   * rendering branch at all). */
  complete: boolean;
  onPress: () => void;
}

/**
 * One compact row per Detalii sub-feature — icon, title, a short one-line
 * status, a set/not-set `StatusDot`, chevron. Tapping is the only way in;
 * there is no per-card "+" anymore, add actions live inside the sub-screen
 * this navigates to.
 */
export function DetaliiHubCard({ icon, title, status, complete, onPress }: DetaliiHubCardProps) {
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${status}`}
      style={[
        styles.row,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: tokens.surfaceBorder ?? 'transparent',
          borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
        },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tokens.accentPrimary}1A` }]}>
        <Feather name={icon} size={19} color={tokens.accentPrimary} />
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, { color: tokens.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.status, { color: tokens.textSecondary }]} numberOfLines={1}>
          {status}
        </Text>
      </View>

      <View style={styles.trailing}>
        <StatusDot complete={complete} />
        <Feather name="chevron-right" size={20} color={tokens.textSecondary} />
      </View>
    </TouchableOpacity>
  );
}

/** Same row/icon/info dimensions as the real card, so nothing shifts on load. */
export function DetaliiHubCardSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={40} height={40} radius={gRadius.pill} />
      <View style={styles.info}>
        <Skeleton height={16} width="55%" radius={4} />
        <Skeleton height={13} width="40%" radius={4} />
      </View>
      <View style={styles.trailing}>
        <Skeleton width={18} height={18} radius={9} />
        <Skeleton width={20} height={20} radius={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
    borderRadius: themeRadius.lg,
    padding: gSpace.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  status: {
    fontSize: 13,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.sm,
  },
});
