import Feather from '@expo/vector-icons/Feather';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { LockedFeature } from '@/components/guest/LockedFeature';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { MessageActionsBar, MessageBubble, MessageBubbleSkeleton } from '@/components/guest/MessageBubble';
import { LongPressRow } from '@/components/LongPressRow';
import { listenToPrivateBroadcast } from '@/data/privateBroadcast';
import { MESSAGES_PAGE_SIZE, remoteRepository } from '@/data/remoteEventContentRepository';
import { supabase } from '@/data/supabaseClient';
import { fetchAvatarUrls } from '@/data/usersRepository';
import { useAuth } from '@/hooks/useAuth';
import { useChatRead } from '@/hooks/useChatRead';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { usePlanGate } from '@/hooks/usePlanGate';
import { useTheme } from '@/hooks/useTheme';
import type { Message, SocialContent } from '@/types/guest';
import type { MessageRow } from '@/types/supabase';
import { confirmDelete } from '@/utils/confirm';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';
import { setActiveChat } from '@/utils/pushNotifications';
import { chatDayLabel, dayKey } from '@/utils/relativeTime';
import type { PickedPhoto } from '@/utils/imageProcessing';
import { generateId } from '@/utils/uuid';

/** Per send, to keep the chat readable and the storage bill small. */
const MAX_PHOTOS_PER_SEND = 5;

const AVATAR_URL_TTL_SECONDS = 24 * 60 * 60;

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'] as const;

/** Vertical space between messages: tighter inside a run from one person. */
const MESSAGE_GAP = 14;
const MESSAGE_RUN_GAP = 4;

const HeldIndexContext = createContext(-1);

/** The actions bar hangs over the neighboring message, so the held row's cell goes on top. */
function MessageCell({ index, style, ...props }: ComponentProps<typeof View> & { index: number }) {
  const heldIndex = useContext(HeldIndexContext);
  return <View {...props} style={[style, { zIndex: index === heldIndex ? 1 : 0 }]} />;
}

interface MessageRowHandlers {
  onHold: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
}

/**
 * Memoized, with stable handlers and plain props: the list re-renders its mounted
 * cells every time its window moves, and without this each scroll step redrew
 * every message (a new native long-press gesture included), not just the new ones.
 */
const ChatMessageRow = memo(function ChatMessageRow({
  message,
  hasPrevious,
  newDay,
  continuesRun,
  endsRun,
  held,
  isOwn,
  fromOrganizer,
  avatarUri,
  avatarDay,
  currentUserId,
  handlers,
}: {
  message: Message;
  hasPrevious: boolean;
  newDay: boolean;
  continuesRun: boolean;
  endsRun: boolean;
  held: boolean;
  isOwn: boolean;
  fromOrganizer: boolean;
  avatarUri: string | undefined;
  avatarDay: string;
  currentUserId: string | undefined;
  handlers: MessageRowHandlers;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={[
        hasPrevious && { marginTop: continuesRun ? MESSAGE_RUN_GAP : MESSAGE_GAP },
        held && styles.heldMessage,
      ]}
    >
      {newDay ? (
        <View style={[styles.dayLabel, { backgroundColor: tokens.surface2 }]}>
          <Text style={[styles.dayLabelText, { color: tokens.textSecondary }]}>{chatDayLabel(message.created_at)}</Text>
        </View>
      ) : null}
      {held ? (
        <MessageActionsBar
          emojis={REACTION_EMOJIS}
          selected={message.reactions.find((reaction) => reaction.user_id === currentUserId)?.emoji ?? null}
          alignEnd={isOwn}
          below={!hasPrevious}
          onPick={(emoji) => handlers.onReact(message.id, emoji)}
          onEdit={isOwn ? () => handlers.onEdit(message) : undefined}
          onDelete={isOwn ? () => handlers.onDelete(message) : undefined}
        />
      ) : null}
      <LongPressRow
        // Anyone can hold a message to react; deleting is for your own only.
        actions={[]}
        onLongPress={() => handlers.onHold(message.id)}
      >
        <MessageBubble
          message={message}
          fromOrganizer={fromOrganizer}
          avatar={avatarUri !== undefined ? { uri: avatarUri, cacheKey: `avatar-${message.sender_id}-${avatarDay}` } : null}
          isOwn={isOwn}
          showSender={!continuesRun}
          showAvatar={endsRun}
          currentUserId={currentUserId}
          onPressReaction={(emoji) => handlers.onReact(message.id, emoji)}
        />
      </LongPressRow>
    </View>
  );
});

export default function ChatScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, sendMessage, sendPhotoMessages, editMessage, deleteMessage, toggleMessageReaction, loadOlderMessages } = useEventContent(id);
  const { hydrated: planHydrated, capabilities } = usePlanGate(id);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<PickedPhoto[]>([]);
  const [sendingPhotos, setSendingPhotos] = useState(false);
  const [heldMessageId, setHeldMessageId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const inputRef = useRef<TextInput>(null);
  // The finger lifting after a long press must not close the bar it just opened.
  const justHeld = useRef(false);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<Message>>(null);
  // Scrolling up loads older pages; a short page means the start was reached.
  const [reachedStart, setReachedStart] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [readingOlder, setReadingOlder] = useState(false);
  const { markRead } = useChatRead(id);
  const insets = useSafeAreaInsets();
  // The composer sits just above the tab bar, closer than the
  // default page clearance (which also leaves room for scrolled content).
  const composerClearance = { paddingBottom: tabBarBottomInset(insets.bottom) + floatingTabBar.height + gSpace.sm };

  // Opening the chat marks it read (resets chat pushes and the tab's unread
  // dot), and so does leaving it or sending the app to the background, so
  // messages seen while here don't count as unread. While it's on screen,
  // a chat push for this event shows no banner.
  useFocusEffect(
    useCallback(() => {
      setActiveChat(id);
      markRead();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          setActiveChat(id);
          markRead();
        } else if (state === 'background') {
          setActiveChat(null);
          markRead();
        }
      });
      return () => {
        subscription.remove();
        setActiveChat(null);
        markRead();
      };
    }, [id, markRead]),
  );

  /** The event's owner or a co-organizer: gets the crown in the chat. */
  const isOrganizer = useCallback(
    (senderId: string): boolean =>
      event !== undefined &&
      (senderId === event.owner_id ||
        event.coOrganizers.some((member) => member.role === 'co_organizer' && member.userId === senderId)),
    [event],
  );

  // Other people's profile photos. The URLs last a day; the day in the cache key
  // keeps the file on disk across restarts, and picks up a new photo by tomorrow.
  const senderIds = [...new Set((content?.messages ?? []).map((message) => message.sender_id))]
    .filter((senderId) => senderId !== user?.id)
    .sort();
  const { data: avatarUrls } = useQuery({
    queryKey: ['chatAvatars', senderIds],
    queryFn: () => fetchAvatarUrls(senderIds, AVATAR_URL_TTL_SECONDS),
    enabled: senderIds.length > 0,
    staleTime: 23 * 60 * 60_000,
    // A new sender on an older page changes the key: don't blank everyone's photo meanwhile.
    placeholderData: (previous) => previous,
  });
  const avatarDay = new Date().toISOString().slice(0, 10);

  /**
   * Realtime replaces the request/response gap CLAUDE.md's §7 flags for
   * messages specifically — moments/reactions/photos are unaffected, still
   * on the 'social' category's 30s staleTime + explicit-invalidation
   * fallback (see hooks/useEventContent.tsx), since only this screen gained
   * a live subscription.
   *
   * Patches the same ['eventContent', 'social', id] cache entry
   * useEventContent's socialQuery owns (see that file) directly via
   * setQueryData, appending rather than refetching, so a new message shows
   * up for every participant — sender included — the instant Postgres
   * broadcasts the insert, with no round trip back through loadSocial.
   */
  useEffect(() => {
    if (id.length === 0) return;
    const socialKey = ['eventContent', 'social', id] as const;
    // Unique topic per subscription: supabase-js hands back an existing channel
    // with the same name, and if the previous one (a quick remount, a Fast
    // Refresh) is still being removed it's already subscribed, so `.on()`
    // throws "cannot add postgres_changes callbacks after subscribe()". The
    // event filter below is what scopes the messages, not the topic name.
    const channel = supabase
      .channel(`messages:${id}:${generateId()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `event_id=eq.${id}` },
        async (payload) => {
          const row = payload.new as MessageRow;
          // A photo's URLs are signed before it's added, so messages can finish
          // out of arrival order: hence the sort. If signing fails, the bubble
          // shows a placeholder until the next refetch.
          const incoming = await remoteRepository
            .mapIncomingMessage(row)
            .catch(() => remoteRepository.mapMessage(row));
          queryClient.setQueryData<SocialContent>(socialKey, (current) =>
            current === undefined || current.messages.some((message) => message.id === incoming.id)
              ? current
              : {
                  ...current,
                  messages: [...current.messages, incoming].sort(
                    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                  ),
                },
          );
        },
      )
      // Someone edited a message: only its text changes, so no refetch.
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `event_id=eq.${id}` },
        (payload) => {
          const row = payload.new as MessageRow;
          queryClient.setQueryData<SocialContent>(socialKey, (current) =>
            current === undefined
              ? current
              : {
                  ...current,
                  messages: current.messages.map((message) =>
                    message.id === row.id ? { ...message, content: row.content, edited_at: row.edited_at } : message,
                  ),
                },
          );
        },
      )
      // Another person's reaction: refetch rather than patch (signed photo URLs
      // are memoized, so this re-downloads nothing). DELETE payloads can't be
      // filtered and carry only the id, hence the lookup.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions', filter: `event_id=eq.${id}` },
        () => void queryClient.invalidateQueries({ queryKey: socialKey }),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'message_reactions', filter: `event_id=eq.${id}` },
        () => void queryClient.invalidateQueries({ queryKey: socialKey }),
      )
      .subscribe();

    // A reaction taken back arrives as a Broadcast on this event's private
    // topic (trigger on_message_reaction_removed_notify, 20261112000003), not
    // as a postgres_changes DELETE: those can't be filtered, so every un-react
    // in the app used to reach every open chat.
    const stopReactionRemovals = listenToPrivateBroadcast(`chat:${id}`, 'reaction_removed', (payload) => {
      const removedId = (payload as { reaction_id?: string } | undefined)?.reaction_id;
      const known = queryClient
        .getQueryData<SocialContent>(socialKey)
        ?.messages.some((message) => message.reactions.some((reaction) => reaction.id === removedId));
      if (known === true) void queryClient.invalidateQueries({ queryKey: socialKey });
    });

    return () => {
      void supabase.removeChannel(channel);
      stopReactionRemovals();
    };
  }, [id, queryClient]);

  const pickPhotos = async () => {
    if (sendingPhotos || attachments.length >= MAX_PHOTOS_PER_SEND) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      orderedSelection: true,
      selectionLimit: MAX_PHOTOS_PER_SEND - attachments.length,
    });
    if (result.canceled) return;

    const picked = result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height }));
    setAttachments((current) => [...current, ...picked].slice(0, MAX_PHOTOS_PER_SEND));
  };

  const takePhoto = async () => {
    if (sendingPhotos || attachments.length >= MAX_PHOTOS_PER_SEND) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled) return;

    const picked = result.assets.map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height }));
    setAttachments((current) => [...current, ...picked].slice(0, MAX_PHOTOS_PER_SEND));
  };

  const attachmentsDisabled = sendingPhotos || editing !== null || attachments.length >= MAX_PHOTOS_PER_SEND;
  const canSend = !sendingPhotos && (draft.trim().length > 0 || attachments.length > 0 || editing?.photo != null);

  const startEditing = useCallback((message: Message) => {
    setHeldMessageId(null);
    setAttachments([]);
    setEditing(message);
    setDraft(message.content);
    inputRef.current?.focus();
  }, []);

  const cancelEditing = () => {
    setEditing(null);
    setDraft('');
  };

  const submit = async () => {
    if (!canSend) return;
    if (editing !== null) {
      if (draft.trim() !== editing.content) editMessage(editing.id, draft);
      cancelEditing();
      return;
    }
    // Your own message always brings you back to the latest one.
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    if (attachments.length === 0) {
      sendMessage(draft);
      setDraft('');
      return;
    }
    setSendingPhotos(true);
    await sendPhotoMessages(attachments, draft);
    setAttachments([]);
    setDraft('');
    setSendingPhotos(false);
  };

  const loadOlder = async () => {
    if (loadingOlder || reachedStart || content === null) return;
    if (content.messages.length < MESSAGES_PAGE_SIZE) {
      setReachedStart(true);
      return;
    }
    setLoadingOlder(true);
    try {
      if (!(await loadOlderMessages())) setReachedStart(true);
    } catch (error) {
      // Scrolling up again retries.
      console.warn('[chat] loading older messages failed', error);
    } finally {
      setLoadingOlder(false);
    }
  };

  // Newest first: the list is inverted, so it stays at the latest message and only
  // the messages on screen get drawn.
  const messages = content?.messages;
  const newestFirst = useMemo(() => (messages === undefined ? [] : [...messages].reverse()), [messages]);
  const heldIndex = newestFirst.findIndex((message) => message.id === heldMessageId);

  // Who sent what around each message, worked out once per list rather than for
  // every mounted cell on every scroll step (it parses dates).
  const rowMeta = useMemo(() => {
    const days = newestFirst.map((message) => dayKey(message.created_at));
    return newestFirst.map((message, index) => {
      const previous = newestFirst[index + 1];
      const next = newestFirst[index - 1];
      const newDay = previous === undefined || days[index + 1] !== days[index];
      return {
        hasPrevious: previous !== undefined,
        newDay,
        continuesRun: !newDay && previous?.sender_id === message.sender_id,
        endsRun: next === undefined || next.sender_id !== message.sender_id || days[index - 1] !== days[index],
      };
    });
  }, [newestFirst]);

  // These change with the content; the rows must not, so they read the latest through a ref.
  const latestActions = useRef({ toggleMessageReaction, deleteMessage });
  useEffect(() => {
    latestActions.current = { toggleMessageReaction, deleteMessage };
  });
  const rowHandlers = useMemo<MessageRowHandlers>(
    () => ({
      onHold: (messageId) => {
        justHeld.current = true;
        setHeldMessageId(messageId);
      },
      onReact: (messageId, emoji) => latestActions.current.toggleMessageReaction(messageId, emoji),
      onEdit: startEditing,
      onDelete: (message) =>
        confirmDelete(t('chat.deleteMessageTitle'), t('chat.deleteMessageBody'), () =>
          latestActions.current.deleteMessage(message.id, message.photo !== null),
        ),
    }),
    [startEditing, t],
  );

  const renderMessage = useCallback(
    ({ item: message, index }: { item: Message; index: number }) => {
      const meta = rowMeta[index];
      if (meta === undefined) return null;
      return (
        <ChatMessageRow
          message={message}
          hasPrevious={meta.hasPrevious}
          newDay={meta.newDay}
          continuesRun={meta.continuesRun}
          endsRun={meta.endsRun}
          held={heldMessageId === message.id}
          isOwn={message.sender_id === user?.id}
          fromOrganizer={isOrganizer(message.sender_id)}
          avatarUri={avatarUrls?.[message.sender_id]}
          avatarDay={avatarDay}
          currentUserId={user?.id}
          handlers={rowHandlers}
        />
      );
    },
    [rowMeta, heldMessageId, user?.id, isOrganizer, avatarUrls, avatarDay, rowHandlers],
  );

  // Chat isn't included in this event's current plan (Esențial). Server-side
  // enforcement is a trigger on messages inserts (see the plan-feature-gating
  // migration) — this is the client-side reflection of the same rule, shown
  // to owner and guest alike rather than just hiding the tab's contents.
  if (planHydrated && !capabilities.chatEnabled) {
    return (
      <GuestScreen transparent>
        <LockedFeature kind="chat" eventId={id} owner={isOwner(event)} />
      </GuestScreen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/*
        GuestScreen's own scroll mode would put the composer inside the same
        ScrollView as the message list, so it scrolls away with the content
        instead of staying pinned. scroll={false} here + an inner FlatList
        for just the messages (flex: 1, so it fills the space between the
        fixed header and the fixed composer below it) keeps the composer's
        position stable while the list scrolls behind it.
      */}
      <GuestScreen scroll={false} contentStyle={{ ...styles.content, ...composerClearance }} transparent>
        {content === null ? (
          <View style={[styles.messagesScroll, styles.skeletons]}>
            <MessageBubbleSkeleton bubbleWidth={150} />
            <MessageBubbleSkeleton bubbleWidth={200} />
            <MessageBubbleSkeleton bubbleWidth={120} />
          </View>
        ) : content.messages.length === 0 ? (
          <View style={styles.messagesScroll}>
            <EmptyState message={t('chat.empty')} />
          </View>
        ) : (
          <HeldIndexContext.Provider value={heldIndex}>
          <FlatList
            ref={listRef}
            inverted
            data={newestFirst}
            keyExtractor={(message) => message.id}
            renderItem={renderMessage}
            CellRendererComponent={MessageCell}
            style={styles.messagesScroll}
            // Inverted, so this keeps a short chat at the top, as a chat that doesn't fill the screen.
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // The bar hangs outside its cell: clipping would cut it off.
            removeClippedSubviews={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={7}
            // Reading older messages isn't interrupted by new ones. Only then: left on all the
            // time it held the list away from the latest message while the first cells rendered.
            maintainVisibleContentPosition={readingOlder ? { minIndexForVisible: 1 } : undefined}
            scrollEventThrottle={100}
            onScroll={(event) => setReadingOlder(event.nativeEvent.contentOffset.y > 80)}
            onEndReachedThreshold={0.5}
            onEndReached={() => void loadOlder()}
            ListFooterComponent={
              loadingOlder ? <ActivityIndicator style={styles.olderSpinner} color={tokens.textSecondary} /> : null
            }
            onScrollBeginDrag={() => setHeldMessageId(null)}
            // Any tap in the list closes the bar, a tap on the bar itself included.
            onTouchEnd={() => {
              if (justHeld.current) justHeld.current = false;
              else setHeldMessageId(null);
            }}
          />
          </HeldIndexContext.Provider>
        )}

        {attachments.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.attachments}
            contentContainerStyle={styles.attachmentsContent}
          >
            {attachments.map((photo, index) => (
              <View key={`${photo.uri}-${index}`}>
                <Image
                  source={{ uri: photo.uri }}
                  style={[styles.attachment, { backgroundColor: tokens.surface2 }, sendingPhotos && styles.attachmentSending]}
                />
                {sendingPhotos ? null : (
                  <TouchableOpacity
                    style={[styles.attachmentRemove, { backgroundColor: tokens.textPrimary }]}
                    onPress={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('chat.removePhoto')}
                  >
                    <Feather name="x" size={12} color={tokens.surface} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </ScrollView>
        ) : null}

        {editing !== null ? (
          <View style={[styles.editBanner, { backgroundColor: tokens.surface2 }]}>
            <Feather name="edit-2" size={15} color={tokens.accentText} />
            <View style={styles.editText}>
              <Text style={[styles.editTitle, { color: tokens.accentText }]}>{t('chat.editingTitle')}</Text>
              <Text style={[styles.editPreview, { color: tokens.textSecondary }]} numberOfLines={1}>
                {editing.content.length > 0 ? editing.content : t('chat.photo')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={cancelEditing}
              hitSlop={10}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Feather name="x" size={18} color={tokens.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.composer}>
          {/* WhatsApp layout: gallery and camera inside the pill; camera steps aside while typing. */}
          <View style={[styles.inputPill, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: tokens.textPrimary }]}
              value={draft}
              onChangeText={setDraft}
              onFocus={() => setHeldMessageId(null)}
              placeholder={t('chat.placeholder')}
              placeholderTextColor={tokens.textMuted}
              multiline
              accessibilityLabel="Mesaj"
            />
            <TouchableOpacity
              style={styles.inputIcon}
              onPress={() => void pickPhotos()}
              disabled={attachmentsDisabled}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={t('chat.attachPhotos')}
            >
              <Feather name="image" size={20} color={attachmentsDisabled ? tokens.textMuted : tokens.textSecondary} />
            </TouchableOpacity>
            {draft.length === 0 ? (
              <TouchableOpacity
                style={styles.inputIcon}
                onPress={() => void takePhoto()}
                disabled={attachmentsDisabled}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel={t('chat.takePhoto')}
              >
                <Feather name="camera" size={20} color={attachmentsDisabled ? tokens.textMuted : tokens.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.send, { backgroundColor: canSend ? tokens.accentFill : tokens.surface2 }]}
            onPress={() => void submit()}
            disabled={!canSend}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
          >
            {sendingPhotos ? (
              <ActivityIndicator size="small" color={tokens.textMuted} />
            ) : (
              <Feather name={editing !== null ? 'check' : 'send'} size={19} color={canSend ? tokens.onAccent : tokens.textMuted} />
            )}
          </TouchableOpacity>
        </View>
      </GuestScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  lockedContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  // scroll={false} on GuestScreen means this styles the fixed outer column
  // directly (header + messages list + composer), not a ScrollView's
  // contentContainerStyle — see the JSX comment above. GuestScreen's own
  // scroll={true} branch applies its internal styles.content (which has
  // paddingHorizontal: gSpace.xl) automatically; the scroll={false} branch
  // does not, so it has to be repeated here — omitting it previously let
  // every child render edge-to-edge, misaligned with EventHeaderBar and the
  // floating tab bar above/below it (both use the same gSpace.xl margin).
  content: {
    paddingHorizontal: 20,
    gap: gSpace.sm,
  },
  headerBlock: {
    gap: gSpace.xs,
  },
  subtitle: {
    fontSize: 13,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingTop: gSpace.sm,
  },
  olderSpinner: {
    paddingVertical: gSpace.md,
  },
  dayLabel: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: MESSAGE_GAP,
  },
  dayLabelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  editBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  editText: {
    flex: 1,
    minWidth: 0,
  },
  editTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  editPreview: {
    fontSize: 13,
  },
  heldMessage: {
    zIndex: 1,
  },
  skeletons: {
    gap: MESSAGE_GAP,
  },
  attachments: {
    flexGrow: 0,
  },
  attachmentsContent: {
    gap: 8,
    paddingTop: 6,
    paddingRight: 6,
  },
  attachment: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  attachmentSending: {
    opacity: 0.5,
  },
  attachmentRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingLeft: 16,
    paddingRight: 6,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
  },
  inputIcon: {
    width: 36,
    height: 41,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
