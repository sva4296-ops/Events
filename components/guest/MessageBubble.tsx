import { StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Message } from '@/types/guest';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { timeOfDay } from '@/utils/relativeTime';

/** Organizer messages are solid accent-colored; everyone else gets a surface bubble. */
export function MessageBubble({ message, fromOrganizer }: { message: Message; fromOrganizer: boolean }) {
  const { tokens } = useTheme();

  return (
    <View style={styles.row}>
      <Text style={[styles.sender, { color: tokens.textSecondary }]}>{message.sender_label}</Text>
      <View
        style={[
          styles.bubble,
          { backgroundColor: fromOrganizer ? tokens.accentPrimary : tokens.surfaceElevated },
        ]}
      >
        <Text style={[styles.text, { color: fromOrganizer ? '#FFFFFF' : tokens.textPrimary }]}>
          {message.content}
        </Text>
      </View>
      <Text style={[styles.time, { color: tokens.textSecondary }]}>{timeOfDay(message.created_at)}</Text>
    </View>
  );
}

/** Same sender/bubble/time dimensions as the real bubble above. `width` varies
 * per instance so a run of them doesn't look like a repeated stamp. */
export function MessageBubbleSkeleton({ bubbleWidth = 160 }: { bubbleWidth?: number }) {
  return (
    <View style={styles.row}>
      <Skeleton height={12} width={72} radius={4} />
      <Skeleton height={38} width={bubbleWidth} radius={gRadius.md} />
      <Skeleton height={10} width={40} radius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    gap: gSpace.xs,
    maxWidth: '88%',
  },
  sender: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: gSpace.xs,
  },
  bubble: {
    borderRadius: gRadius.md,
    borderTopLeftRadius: gSpace.xs,
    paddingHorizontal: gSpace.lg,
    paddingVertical: gSpace.md,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  time: {
    fontSize: 10,
    paddingHorizontal: gSpace.xs,
  },
});
