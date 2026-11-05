import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LineIcon, type Shape } from '@/components/EventTypeIcon';
import { PhotoViewer } from '@/components/PhotoViewer';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Message, MessagePhoto, MessageReaction } from '@/types/guest';
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

const PHOTO_WIDTH = 220;
const PHOTO_MIN_HEIGHT = 140;
const PHOTO_MAX_HEIGHT = 300;

/** Fixed width and a height from the photo's own ratio (clamped), so the list
 * doesn't jump when the image loads. Tap opens the full version. */
function BubblePhoto({ messageId, photo, caption }: { messageId: string; photo: MessagePhoto; caption: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [viewerOpen, setViewerOpen] = useState(false);
  const height = Math.min(
    PHOTO_MAX_HEIGHT,
    Math.max(PHOTO_MIN_HEIGHT, (PHOTO_WIDTH * photo.height) / photo.width),
  );
  const frame = { width: PHOTO_WIDTH, height, backgroundColor: tokens.surface2 };

  if (photo.thumb_url === null) {
    return (
      <View style={[styles.photo, styles.photoMissing, frame]}>
        <Feather name="image" size={24} color={tokens.textMuted} />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setViewerOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={t('chat.photo')}
      >
        {/* Keyed by message, not URL: signed URLs change, the file never does,
            so a restart reads the disk instead of downloading it again. */}
        <Image
          source={{ uri: photo.thumb_url, cacheKey: `chat-${messageId}-thumb` }}
          cachePolicy="disk"
          contentFit="cover"
          recyclingKey={messageId}
          style={[styles.photo, frame]}
        />
      </TouchableOpacity>
      <PhotoViewer
        uri={photo.full_url ?? photo.thumb_url}
        cacheKey={`chat-${messageId}-${photo.full_url !== null ? 'full' : 'thumb'}`}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        caption={caption}
      />
    </>
  );
}

/** http(s) links and bare www. addresses; nothing else opens (no tel:, intent:, …). */
const LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s]+)/gi;
/** Sentence punctuation right after a link isn't part of it. */
const LINK_TRAILING_PUNCTUATION = /[.,!?;:)\]}»"'”]+$/;

/** The message's text with its links underlined; a tap opens the browser. */
function LinkedText({ text, linkColor }: { text: string; linkColor?: string }) {
  return (
    <>
      {text.split(LINK_PATTERN).map((part, index) => {
        // split() with a capture group: odd indexes are the matches.
        if (index % 2 === 0) return part;
        const trailing = LINK_TRAILING_PUNCTUATION.exec(part)?.[0] ?? '';
        const link = part.slice(0, part.length - trailing.length);
        const url = /^https?:\/\//i.test(link) ? link : `https://${link}`;
        return (
          <Text key={`${index}-${link}`}>
            <Text
              style={[styles.link, linkColor !== undefined && { color: linkColor }]}
              onPress={() => void Linking.openURL(url).catch(() => undefined)}
              accessibilityRole="link"
            >
              {link}
            </Text>
            {trailing}
          </Text>
        );
      })}
    </>
  );
}

/**
 * Photo, text and time inside the bubble, WhatsApp style. The time sits in the
 * bottom corner; an invisible copy at the end of the text reserves its room, so
 * it shares the last line when there's space and the text wraps around it when not.
 */
function BubbleContent({
  message,
  textColor,
  timeColor,
  linkColor,
}: {
  message: Message;
  textColor: string;
  timeColor: string;
  linkColor?: string;
}) {
  const { t } = useTranslation();
  const clock = timeOfDay(message.created_at);
  const time = message.edited_at !== null ? `${t('chat.edited')} ${clock}` : clock;
  const hasText = message.content.length > 0;

  return (
    <>
      {message.photo !== null ? (
        <BubblePhoto messageId={message.id} photo={message.photo} caption={message.content} />
      ) : null}
      {hasText ? (
        <Text style={[styles.text, message.photo !== null && styles.photoCaption, { color: textColor }]}>
          <LinkedText text={message.content} linkColor={linkColor} />
          <Text style={styles.timeSpacer}>{`   ${time}`}</Text>
        </Text>
      ) : null}
      {hasText ? (
        <Text style={[styles.time, message.photo !== null && styles.timeWithPhoto, { color: timeColor }]}>{time}</Text>
      ) : (
        <View style={styles.timeOnPhoto}>
          <Text style={styles.timeOnPhotoText}>{time}</Text>
        </View>
      )}
    </>
  );
}

/** One chip per emoji with its count, overlapping the bubble's bottom edge.
 * Your own is tinted; tapping a chip reacts with that emoji (or removes yours). */
function ReactionChips({
  reactions,
  alignEnd,
  currentUserId,
  onPress,
}: {
  reactions: MessageReaction[];
  alignEnd: boolean;
  currentUserId?: string;
  onPress?: (emoji: string) => void;
}) {
  const { tokens } = useTheme();
  if (reactions.length === 0) return null;

  const emojis = [...new Set(reactions.map((reaction) => reaction.emoji))];
  return (
    <View style={[styles.reactions, alignEnd ? styles.reactionsEnd : styles.reactionsStart]}>
      {emojis.map((emoji) => {
        const matching = reactions.filter((reaction) => reaction.emoji === emoji);
        const mine = matching.some((reaction) => reaction.user_id === currentUserId);
        return (
          <TouchableOpacity
            key={emoji}
            style={[
              styles.reactionChip,
              { backgroundColor: mine ? tokens.accentTint : tokens.surface, borderColor: tokens.border },
            ]}
            onPress={() => onPress?.(emoji)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${emoji} ${matching.length}`}
            accessibilityState={{ selected: mine }}
          >
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {matching.length > 1 ? (
              <Text style={[styles.reactionCount, { color: tokens.textSecondary }]}>{matching.length}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Reactions and delete for the held message, floating right at it. Absolute, so
 * opening it doesn't move the list. `below` is for the first message, which has
 * nothing above it to float over.
 */
export function MessageActionsBar({
  emojis,
  selected,
  alignEnd,
  below,
  onPick,
  onEdit,
  onDelete,
}: {
  emojis: readonly string[];
  selected: string | null;
  alignEnd: boolean;
  below: boolean;
  onPick: (emoji: string) => void;
  /** Both absent on other people's messages. */
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.actionsBar,
        alignEnd ? styles.actionsBarEnd : styles.actionsBarStart,
        below ? styles.actionsBarBelow : styles.actionsBarAbove,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
      ]}
    >
      {emojis.map((emoji) => (
        <TouchableOpacity
          key={emoji}
          style={[styles.actionButton, selected === emoji && { backgroundColor: tokens.accentTint }]}
          onPress={() => onPick(emoji)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={emoji}
          accessibilityState={{ selected: selected === emoji }}
        >
          <Text style={styles.actionEmoji}>{emoji}</Text>
        </TouchableOpacity>
      ))}
      {onEdit !== undefined ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onEdit}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={t('common.edit')}
        >
          <Feather name="edit-2" size={17} color={tokens.textPrimary} />
        </TouchableOpacity>
      ) : null}
      {onDelete !== undefined ? (
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onDelete}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={t('common.delete')}
        >
          <Feather name="trash-2" size={18} color={tokens.destructive} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Warm Story 2.0 chat bubble. Your own messages sit right on the accent fill
 * with no avatar; everyone else's sit left on a bordered surface with an
 * avatar (profile photo, or initials), and organizers get a crown on the avatar
 * and next to their name. In a run of messages from the same person, only the
 * first shows the name and only the last the avatar.
 */
export function MessageBubble({
  message,
  fromOrganizer,
  avatar = null,
  isOwn,
  showSender = true,
  showAvatar = true,
  currentUserId,
  onPressReaction,
}: {
  message: Message;
  /** Owner or co-organizer: crown on the avatar and a crown chip. */
  fromOrganizer: boolean;
  /** The sender's profile photo; null shows their initials. */
  avatar?: { uri: string; cacheKey: string } | null;
  isOwn: boolean;
  /** False when the previous message is from the same person. */
  showSender?: boolean;
  /** False when the next message is from the same person. */
  showAvatar?: boolean;
  currentUserId?: string;
  onPressReaction?: (emoji: string) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const reactionChips = (
    <ReactionChips
      reactions={message.reactions}
      alignEnd={isOwn}
      currentUserId={currentUserId}
      onPress={onPressReaction}
    />
  );

  if (isOwn) {
    return (
      <View style={[styles.ownRow]}>
        <View
          style={[
            styles.bubble,
            styles.bubbleOwn,
            message.photo !== null && styles.bubbleWithPhoto,
            { backgroundColor: tokens.accentFill },
          ]}
        >
          <BubbleContent message={message} textColor={tokens.onAccent} timeColor={tokens.onAccent} />
        </View>
        {reactionChips}
      </View>
    );
  }

  const initials = initialsOf(message.sender_label);

  return (
    <View style={styles.otherRow}>
      {!showAvatar ? (
        <View style={styles.avatarSpacer} />
      ) : fromOrganizer ? (
        <View>
          {avatar !== null ? (
            <Image source={avatar} cachePolicy="disk" contentFit="cover" style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={brandGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.avatar}
            >
              <Text maxFontSizeMultiplier={1.2} style={[styles.avatarText, { color: '#FFFFFF' }]}>{initials}</Text>
            </LinearGradient>
          )}
          <View style={[styles.crownBadge, { backgroundColor: tokens.accentFill, borderColor: tokens.surface }]}>
            <LineIcon shapes={CROWN} size={9} color={tokens.onAccent} strokeWidth={2.6} />
          </View>
        </View>
      ) : avatar !== null ? (
        <Image source={avatar} cachePolicy="disk" contentFit="cover" style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: tokens.accentTint }]}>
          <Text maxFontSizeMultiplier={1.2} style={[styles.avatarText, { color: tokens.accentText }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.column}>
        {showSender ? (
          <View style={styles.senderRow}>
            <Text style={[styles.sender, { color: tokens.textSecondary }]} numberOfLines={1}>
              {message.sender_label}
            </Text>
            {fromOrganizer ? (
              <View accessible accessibilityLabel={t('chat.organizerBadge')}>
                <LineIcon shapes={CROWN} size={13} color={tokens.accentText} strokeWidth={2.2} />
              </View>
            ) : null}
          </View>
        ) : null}
        <View
          style={[
            styles.bubble,
            styles.bubbleOther,
            message.photo !== null && styles.bubbleWithPhoto,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <BubbleContent
            message={message}
            textColor={tokens.textPrimary}
            timeColor={tokens.textSecondary}
            linkColor={tokens.accentText}
          />
        </View>
        {reactionChips}
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
  },
  // Keeps a run's bubbles aligned where the avatar is left out.
  avatarSpacer: {
    width: 32,
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
  actionsBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  actionsBarAbove: {
    bottom: '100%',
    marginBottom: 2,
  },
  actionsBarBelow: {
    top: '100%',
    marginTop: 2,
  },
  actionsBarStart: {
    left: 40,
  },
  actionsBarEnd: {
    right: 0,
  },
  actionButton: {
    width: 36,
    height: 38,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionEmoji: {
    fontSize: 21,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: -2,
    paddingHorizontal: 8,
  },
  reactionsStart: {
    alignSelf: 'flex-start',
  },
  reactionsEnd: {
    alignSelf: 'flex-end',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  reactionEmoji: {
    fontSize: 13,
  },
  reactionCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  link: {
    textDecorationLine: 'underline',
  },
  bubbleWithPhoto: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  photo: {
    borderRadius: 14,
  },
  photoMissing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCaption: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
    maxWidth: PHOTO_WIDTH,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  time: {
    position: 'absolute',
    // Puts its baseline on the last text line's (15/22 text in the bubble's padding).
    right: 14,
    bottom: 11,
    fontSize: 11,
    lineHeight: 16,
    opacity: 0.75,
  },
  timeWithPhoto: {
    right: 14,
    bottom: 9,
  },
  // Same size as the visible time, so the reserved room matches it.
  timeSpacer: {
    fontSize: 11,
    color: 'transparent',
  },
  timeOnPhoto: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  timeOnPhotoText: {
    fontSize: 11,
    lineHeight: 15,
    color: '#FFFFFF',
  },
});
