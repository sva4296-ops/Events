import { StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Message } from '@/types/guest';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { timeOfDay } from '@/utils/relativeTime';

/** Organizer messages are solid accent-colored; everyone else gets a surface bubble.
 * `isOwn` mirrors the row to the right side of the screen for the current user's own
 * messages (standard chat UX) — colors/sender-label/timestamp are unchanged either way. */
export function MessageBubble({
  message,
  fromOrganizer,
  isOwn,
}: {
  message: Message;
  fromOrganizer: boolean;
  isOwn: boolean;
}) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.row, isOwn ? styles.rowOwn : styles.rowOther]}>
      <Text style={[styles.sender, { color: tokens.textSecondary }]}>{message.sender_label}</Text>
      <View
        style={[
          styles.bubble,
          isOwn ? styles.bubbleOwn : styles.bubbleOther,
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
    gap: gSpace.xs,
    maxWidth: '88%',
  },
  // alignSelf positions the row within the message list (left/right edge);
  // alignItems positions the sender label and timestamp within the row's own
  // width, so they stay flush above/below whichever side the bubble sits on.
  rowOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  rowOwn: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  sender: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: gSpace.xs,
  },
  bubble: {
    borderRadius: gRadius.md,
    paddingHorizontal: gSpace.lg,
    paddingVertical: gSpace.md,
  },
  // The small "tail" corner mirrors to the outer edge — pointing left for an
  // incoming message, right for an outgoing one — same as the row's own alignment.
  bubbleOther: {
    borderTopLeftRadius: gSpace.xs,
  },
  bubbleOwn: {
    borderTopRightRadius: gSpace.xs,
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
