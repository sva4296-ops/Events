import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  AppState,
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
import { remoteRepository } from '@/data/remoteEventContentRepository';
import { supabase } from '@/data/supabaseClient';
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

const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'] as const;

/** Vertical space between messages: tighter inside a run from one person. */
const MESSAGE_GAP = 14;
const MESSAGE_RUN_GAP = 4;

export default function ChatScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, sendMessage, sendPhotoMessages, editMessage, deleteMessage, toggleMessageReaction } = useEventContent(id);
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
  const scrollRef = useRef<ScrollView>(null);
  // False until the first real (non-skeleton) content size lands, so that
  // first snap to the bottom is instant — matching "opens already scrolled
  // to the latest message" — while every later arrival (send or Realtime
  // receive) animates instead of jumping.
  const hasScrolledInitialContent = useRef(false);
  const { markRead } = useChatRead(id);
  const insets = useSafeAreaInsets();
  // The composer sits just above the floating tab bar, closer than the
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

  /**
   * Organizer mark in the chat: undefined for a guest, null for the event's
   * owner (chip reads "Organizator"), or a co-organizer's label ("Naș"…).
   */
  const organizerLabelFor = (senderId: string): string | null | undefined => {
    if (event === undefined) return undefined;
    if (event.owner_id !== undefined && senderId === event.owner_id) return null;
    const member = event.coOrganizers.find(
      (candidate) => candidate.role === 'co_organizer' && candidate.userId === senderId,
    );
    if (member === undefined) return undefined;
    return member.relation !== null ? t(`coOrganizers.relation.${member.relation}`) : t('home.coOrganizer');
  };

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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        const removedId = (payload.old as { id?: string }).id;
        const known = queryClient
          .getQueryData<SocialContent>(socialKey)
          ?.messages.some((message) => message.reactions.some((reaction) => reaction.id === removedId));
        if (known === true) void queryClient.invalidateQueries({ queryKey: socialKey });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
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

  const startEditing = (message: Message) => {
    setHeldMessageId(null);
    setAttachments([]);
    setEditing(message);
    setDraft(message.content);
    inputRef.current?.focus();
  };

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

  const messages = content?.messages ?? [];

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
        instead of staying pinned. scroll={false} here + an inner ScrollView
        for just the messages (flex: 1, so it fills the space between the
        fixed header and the fixed composer below it) keeps the composer's
        position stable while the list scrolls behind it.
      */}
      <GuestScreen scroll={false} contentStyle={{ ...styles.content, ...composerClearance }} transparent>
        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => setHeldMessageId(null)}
          // Any tap in the list closes the bar, a tap on the bar itself included.
          onTouchEnd={() => {
            if (justHeld.current) justHeld.current = false;
            else setHeldMessageId(null);
          }}
          // Android doesn't clamp the scroll offset when the list grows taller
          // (keyboard closing), which left an empty gap above the composer.
          onLayout={() => {
            if (content !== null) scrollRef.current?.scrollToEnd({ animated: false });
          }}
          // Fires whenever the message list's own content height changes —
          // initial load (skeletons -> real history), a message this device
          // just sent, or one the Realtime subscription just appended — so
          // one handler covers all three required triggers without this
          // screen needing to hook into the send handler or the Realtime
          // callback itself. Skeleton-phase size changes (content === null)
          // are ignored so the *first real* layout is the one that snaps
          // instantly; every one after that animates.
          onContentSizeChange={() => {
            if (content === null) return;
            scrollRef.current?.scrollToEnd({ animated: hasScrolledInitialContent.current });
            hasScrolledInitialContent.current = true;
          }}
        >
          {content === null ? (
            <View style={styles.skeletons}>
              <MessageBubbleSkeleton bubbleWidth={150} />
              <MessageBubbleSkeleton bubbleWidth={200} />
              <MessageBubbleSkeleton bubbleWidth={120} />
            </View>
          ) : null}

          {content !== null && content.messages.length === 0 ? (
            <EmptyState message={t('chat.empty')} />
          ) : null}

          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const next = messages[index + 1];
            const newDay = previous === undefined || dayKey(previous.created_at) !== dayKey(message.created_at);
            const continuesRun = !newDay && previous?.sender_id === message.sender_id;
            const endsRun =
              next === undefined ||
              next.sender_id !== message.sender_id ||
              dayKey(next.created_at) !== dayKey(message.created_at);
            return (
              <View
                key={message.id}
                style={[
                  index > 0 && { marginTop: continuesRun ? MESSAGE_RUN_GAP : MESSAGE_GAP },
                  heldMessageId === message.id && styles.heldMessage,
                ]}
              >
                {newDay ? (
                  <View style={[styles.dayLabel, { backgroundColor: tokens.surface2 }]}>
                    <Text style={[styles.dayLabelText, { color: tokens.textSecondary }]}>
                      {chatDayLabel(message.created_at)}
                    </Text>
                  </View>
                ) : null}
                {heldMessageId === message.id ? (
                  <MessageActionsBar
                    emojis={REACTION_EMOJIS}
                    selected={message.reactions.find((reaction) => reaction.user_id === user?.id)?.emoji ?? null}
                    alignEnd={message.sender_id === user?.id}
                    below={index === 0}
                    onPick={(emoji) => toggleMessageReaction(message.id, emoji)}
                    onEdit={message.sender_id === user?.id ? () => startEditing(message) : undefined}
                    onDelete={
                      message.sender_id === user?.id
                        ? () =>
                            confirmDelete(t('chat.deleteMessageTitle'), t('chat.deleteMessageBody'), () =>
                              deleteMessage(message.id, message.photo !== null),
                            )
                        : undefined
                    }
                  />
                ) : null}
                <LongPressRow
                  // Anyone can hold a message to react; deleting is for your own only.
                  actions={[]}
                  onLongPress={() => {
                    justHeld.current = true;
                    setHeldMessageId(message.id);
                  }}
                >
                  <MessageBubble
                    message={message}
                    fromOrganizer={organizerLabelFor(message.sender_id) !== undefined}
                    organizerLabel={organizerLabelFor(message.sender_id) ?? null}
                    isOwn={message.sender_id === user?.id}
                    showSender={!continuesRun}
                    showAvatar={endsRun}
                    currentUserId={user?.id}
                    onPressReaction={(emoji) => toggleMessageReaction(message.id, emoji)}
                  />
                </LongPressRow>
              </View>
            );
          })}
        </ScrollView>

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
  // directly (header + messages ScrollView + composer), not a ScrollView's
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
    paddingBottom: gSpace.sm,
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
