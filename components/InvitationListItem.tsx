import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { RsvpBadge } from '@/components/RsvpBadge';
import type { Invitation } from '@/utils/invitations';
import { getEventType } from '@/utils/eventTypes';
import { formatEventDate } from '@/utils/format';
import { colors, radius, shadow, spacing } from '@/utils/theme';

export function InvitationListItem({
  invitation,
  onPress,
}: {
  invitation: Invitation;
  onPress: () => void;
}) {
  const { event, guest } = invitation;
  const type = getEventType(event.type);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${guest.status}`}
      style={styles.row}
    >
      <LinearGradient colors={type.gradient} style={styles.badge}>
        <Text style={styles.emoji}>{type.emoji}</Text>
      </LinearGradient>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {formatEventDate(event.date)}
        </Text>
      </View>

      <RsvpBadge status={guest.status} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
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
    color: colors.text,
  },
  date: {
    fontSize: 12,
    color: colors.muted,
  },
});
