import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { LineIcon, type Shape } from '@/components/EventTypeIcon';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Message } from '@/types/guest';
import { timeOfDay } from '@/utils/relativeTime';
import { brandGradient } from '@/utils/themeTokens';

/** Lucide "crown" (ISC, https://lucide.dev): marks the organizers in the chat. */
const CROWN: readonly Shape[] = [
  {
    type: 'path',
    d: 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z',
  },
  { type: 'path', d: 'M5 21h14' },
];

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
  organizerLabel = null,
  isOwn,
}: {
  message: Message;
  /** Owner or co-organizer: crown on the avatar and a crown chip. */
  fromOrganizer: boolean;
  /** Co-organizer's label ("Naș", "Mireasă"…); null shows "Organizator". */
  organizerLabel?: string | null;
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
        <View style={styles.avatarWrap}>
          <LinearGradient
            colors={brandGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.avatar, styles.avatarInWrap]}
          >
            <Text maxFontSizeMultiplier={1.2} style={[styles.avatarText, { color: '#FFFFFF' }]}>{initials}</Text>
          </LinearGradient>
          <View style={[styles.crownBadge, { backgroundColor: tokens.accentFill, borderColor: tokens.surface }]}>
            <LineIcon shapes={CROWN} size={9} color={tokens.onAccent} strokeWidth={2.6} />
          </View>
        </View>
      ) : (
        <View style={[styles.avatar, { backgroundColor: tokens.accentTint }]}>
          <Text maxFontSizeMultiplier={1.2} style={[styles.avatarText, { color: tokens.accentText }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.column}>
        <View style={styles.senderRow}>
          <Text style={[styles.sender, { color: tokens.textSecondary }]} numberOfLines={1}>
            {message.sender_label}
          </Text>
          {fromOrganizer ? (
            <View style={[styles.chip, { backgroundColor: tokens.accentTint }]}>
              <LineIcon shapes={CROWN} size={11} color={tokens.accentText} strokeWidth={2.2} />
              <Text style={[styles.chipText, { color: tokens.accentText }]}>
                {organizerLabel ?? t('chat.organizerBadge')}
              </Text>
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
  avatarWrap: {
    marginBottom: 18,
  },
  avatarInWrap: {
    marginBottom: 0,
  },
  crownBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 22,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: 'center',
    paddingVertical: 4,
    flexShrink: 1,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    flexShrink: 1,
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
