import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Message } from '@/types/guest';
import { timeOfDay } from '@/utils/relativeTime';
import { brandGradient } from '@/utils/themeTokens';

function initialsOf(label: string): string {
  return label
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * Warm Story 2.0 chat bubble. Your own messages sit right on the accent fill
 * with no avatar; everyone else's sit left on a bordered surface with an
 * initials avatar, and the organizer gets the brand-gradient avatar plus an
 * "Organizator" chip.
 */
export function MessageBubble({
  message,
  fromOrganizer,
  isOwn,
}: {
  message: Message;
  fromOrganizer: boolean;
  isOwn: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  if (isOwn) {
    return (
      <View style={[styles.ownRow]}>
        <View style={[styles.bubble, styles.bubbleOwn, { backgroundColor: tokens.accentFill }]}>
          <Text style={[styles.text, { color: tokens.onAccent }]}>{message.content}</Text>
        </View>
        <Text style={[styles.time, { color: tokens.textSecondary }]}>{timeOfDay(message.created_at)}</Text>
      </View>
    );
  }

  const initials = initialsOf(message.sender_label);

  return (
    <View style={styles.otherRow}>
      {fromOrganizer ? (
        <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.avatar}>
          <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>{initials}</Text>
        </LinearGradient>
      ) : (
        <View style={[styles.avatar, { backgroundColor: tokens.accentTint }]}>
          <Text style={[styles.avatarText, { color: tokens.accentText }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.column}>
        <View style={styles.senderRow}>
          <Text style={[styles.sender, { color: tokens.textSecondary }]} numberOfLines={1}>
            {message.sender_label}
          </Text>
          {fromOrganizer ? (
            <View style={[styles.chip, { backgroundColor: tokens.accentTint }]}>
              <Text style={[styles.chipText, { color: tokens.accentText }]}>{t('chat.organizerBadge')}</Text>
            </View>
          ) : null}
        </View>
        <View
          style={[
            styles.bubble,
            styles.bubbleOther,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <Text style={[styles.text, { color: tokens.textPrimary }]}>{message.content}</Text>
        </View>
        <Text style={[styles.time, { color: tokens.textSecondary }]}>{timeOfDay(message.created_at)}</Text>
      </View>
    </View>
  );
}

/** Same avatar/bubble dimensions as the real bubble above. `width` varies
 * per instance so a run of them doesn't look like a repeated stamp. */
export function MessageBubbleSkeleton({ bubbleWidth = 160 }: { bubbleWidth?: number }) {
  return (
    <View style={styles.otherRow}>
      <Skeleton width={32} height={32} radius={16} />
      <View style={styles.column}>
        <Skeleton height={12} width={72} radius={4} />
        <Skeleton height={42} width={bubbleWidth} radius={18} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  otherRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '86%',
    alignSelf: 'flex-start',
  },
  ownRow: {
    maxWidth: '78%',
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    gap: 4,
  },
  column: {
    flexShrink: 1,
    gap: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600',
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sender: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  chip: {
    height: 22,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleOther: {
    borderWidth: 1,
    borderBottomLeftRadius: 6,
  },
  bubbleOwn: {
    borderBottomRightRadius: 6,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  // Explicit lineHeight + a little bottom room: SwipeableRow clips its
  // overflow, and the default line box cut off the bottom of the digits.
  time: {
    fontSize: 11,
    lineHeight: 16,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
});
