import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import type { AppEvent } from '@/types/event';
import { getEventType } from '@/utils/eventTypes';
import { countRsvps, eventSubtitle } from '@/utils/format';
import { colors, radius, shadow, spacing } from '@/utils/theme';

export function EventListItem({ event, onPress }: { event: AppEvent; onPress: () => void }) {
  const type = getEventType(event.type);
  const counts = countRsvps(event.guests);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${counts.confirmed} confirmed`}
      style={styles.row}
    >
      <LinearGradient colors={type.gradient} style={styles.badge}>
        <Text style={styles.emoji}>{type.emoji}</Text>
      </LinearGradient>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {eventSubtitle(event)}
        </Text>
        <Text style={styles.counts}>
          {counts.confirmed} confirmed · {counts.pending} pending
        </Text>
      </View>

      <Feather name="chevron-right" size={20} color={colors.faint} />
    </TouchableOpacity>
  );
}

/** Same row/badge/info dimensions as the real row above, so nothing shifts when data lands. */
export function EventListItemSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={52} height={52} radius={radius.md} />
      <View style={styles.info}>
        <Skeleton height={16} width="70%" radius={4} />
        <Skeleton height={13} width="50%" radius={4} />
        <Skeleton height={12} width="35%" radius={4} />
      </View>
      <Skeleton width={20} height={20} radius={10} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  counts: {
    fontSize: 12,
    color: colors.faint,
  },
});
