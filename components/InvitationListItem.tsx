import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RsvpBadge } from '@/components/RsvpBadge';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Invitation } from '@/utils/invitations';
import { getEventType } from '@/utils/eventTypes';
import { formatEventDate } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export function InvitationListItem({
  invitation,
  onPress,
}: {
  invitation: Invitation;
  onPress: () => void;
}) {
  const { event, guest } = invitation;
  const { tokens } = useTheme();
  const type = getEventType(event.type);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${guest.status}`}
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
      <LinearGradient colors={type.gradient} style={styles.badge}>
        <Text style={styles.emoji}>{type.emoji}</Text>
      </LinearGradient>

      <View style={styles.info}>
        <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={[styles.date, { color: tokens.textSecondary }]} numberOfLines={1}>
          {formatEventDate(event.date)}
        </Text>
      </View>

      <RsvpBadge status={guest.status} />
    </TouchableOpacity>
  );
}

/** Same row/badge/info dimensions as the real row above, so nothing shifts when data lands. */
export function InvitationListItemSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} radius={themeRadius.md} />
      <View style={styles.info}>
        <Skeleton height={15} width="65%" radius={4} />
        <Skeleton height={12} width="40%" radius={4} />
      </View>
      <Skeleton width={64} height={22} radius={themeRadius.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: themeRadius.lg,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  date: {
    fontSize: 12,
  },
});
