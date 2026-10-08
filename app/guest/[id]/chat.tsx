import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { LockedFeature } from '@/components/guest/LockedFeature';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { MessageBubble, MessageBubbleSkeleton } from '@/components/guest/MessageBubble';
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
import type { SocialContent } from '@/types/guest';
import type { MessageRow } from '@/types/supabase';
import { confirmDelete } from '@/utils/confirm';
import { floatingTabBar, gSpace, tabBarBottomInset } from '@/utils/guestTheme';
import { setActiveChat } from '@/utils/pushNotifications';
import { generateId } from '@/utils/uuid';

export default function ChatScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, sendMessage, deleteMessage } = useEventContent(id);
  const { hydrated: planHydrated, capabilities } = usePlanGate(id);
  const [draft, setDraft] = useState('');
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
        (payload) => {
          const incoming = remoteRepository.mapMessage(payload.new as MessageRow);
          queryClient.setQueryData<SocialContent>(socialKey, (current) =>
            current === undefined || current.messages.some((message) => message.id === incoming.id)
              ? current
              : { ...current, messages: [...current.messages, incoming] },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const submit = () => {
    sendMessage(draft);
    setDraft('');
  };

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
            <>
              <MessageBubbleSkeleton bubbleWidth={150} />
              <MessageBubbleSkeleton bubbleWidth={200} />
              <MessageBubbleSkeleton bubbleWidth={120} />
            </>
          ) : null}

          {content !== null && content.messages.length === 0 ? (
            <EmptyState message={t('chat.empty')} />
          ) : null}

          {content?.messages.map((message) => (
            <LongPressRow
              key={message.id}
              // Only your own messages: hold one to delete it (with a confirmation,
              // like every other delete in the app).
              enabled={message.sender_id === user?.id}
              title={message.content.length > 60 ? `${message.content.slice(0, 60)}…` : message.content}
              actions={[
                {
                  label: t('common.delete'),
                  tone: 'delete',
                  onPress: () =>
                    confirmDelete(t('chat.deleteMessageTitle'), t('chat.deleteMessageBody'), () =>
                      deleteMessage(message.id),
                    ),
                },
              ]}
            >
              <MessageBubble
                message={message}
                fromOrganizer={organizerLabelFor(message.sender_id) !== undefined}
                organizerLabel={organizerLabelFor(message.sender_id) ?? null}
                isOwn={message.sender_id === user?.id}
              />
            </LongPressRow>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: tokens.surface,
                borderColor: tokens.border,
                color: tokens.textPrimary,
              },
            ]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={tokens.textMuted}
            multiline
            accessibilityLabel="Mesaj"
          />
          <TouchableOpacity
            style={[styles.send, { backgroundColor: draft.trim().length > 0 ? tokens.accentFill : tokens.surface2 }]}
            onPress={submit}
            disabled={draft.trim().length === 0}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('chat.send')}
          >
            <Feather name="send" size={19} color={draft.trim().length > 0 ? tokens.onAccent : tokens.textMuted} />
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
    gap: 14,
    paddingBottom: gSpace.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
