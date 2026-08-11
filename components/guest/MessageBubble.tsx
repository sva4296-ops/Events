import { StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import type { Message } from '@/types/guest';
import { guest, gRadius, gSpace } from '@/utils/guestTheme';
import { timeOfDay } from '@/utils/relativeTime';

/** Organizer messages are solid purple; everyone else gets a white bubble. */
export function MessageBubble({ message, fromOrganizer }: { message: Message; fromOrganizer: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.sender}>{message.sender_label}</Text>
      <View style={[styles.bubble, fromOrganizer ? styles.organizerBubble : styles.guestBubble]}>
        <Text style={[styles.text, fromOrganizer && styles.organizerText]}>{message.content}</Text>
      </View>
      <Text style={styles.time}>{timeOfDay(message.created_at)}</Text>
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
    color: guest.body,
    paddingHorizontal: gSpace.xs,
  },
  bubble: {
    borderRadius: gRadius.md,
    paddingHorizontal: gSpace.lg,
    paddingVertical: gSpace.md,
  },
  guestBubble: {
    backgroundColor: guest.white,
    borderTopLeftRadius: gSpace.xs,
  },
  organizerBubble: {
    backgroundColor: guest.purple,
    borderTopLeftRadius: gSpace.xs,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: guest.ink,
  },
  organizerText: {
    color: guest.white,
  },
  time: {
    fontSize: 10,
    color: guest.faint,
    paddingHorizontal: gSpace.xs,
  },
});
