import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { MessageBubble, MessageBubbleSkeleton } from '@/components/guest/MessageBubble';
import { SectionLabel } from '@/components/guest/SectionLabel';
import { closeOpenSwipeRow, SwipeableRow } from '@/components/SwipeableRow';
import { remoteRepository } from '@/data/remoteEventContentRepository';
import { supabase } from '@/data/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import type { SocialContent } from '@/types/guest';
import type { MessageRow } from '@/types/supabase';
import { gRadius, gSpace } from '@/utils/guestTheme';

export default function ChatScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const { content, sendMessage, deleteMessage } = useEventContent(id);
  const [draft, setDraft] = useState('');
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  // False until the first real (non-skeleton) content size lands, so that
  // first snap to the bottom is instant — matching "opens already scrolled
  // to the latest message" — while every later arrival (send or Realtime
  // receive) animates instead of jumping.
  const hasScrolledInitialContent = useRef(false);

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
    const channel = supabase
      .channel(`messages:${id}`)
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
      <GuestScreen scroll={false} contentStyle={styles.content} transparent>
        <View style={styles.headerBlock}>
          <SectionLabel>{t('chat.sectionLabel')}</SectionLabel>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>{t('chat.subtitle')}</Text>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.messagesScroll}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={closeOpenSwipeRow}
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
            <SwipeableRow
              key={message.id}
              // Only your own messages swipe; everyone else's stay static.
              enabled={message.sender_id === user?.id}
              actions={[
                {
                  label: t('common.delete'),
                  icon: 'trash-2',
                  tone: 'delete',
                  // Low stakes: deletes straight away, no confirmation.
                  onPress: () => deleteMessage(message.id),
                },
              ]}
            >
              <MessageBubble
                message={message}
                fromOrganizer={
                  event?.owner_id !== undefined && message.sender_id === event.owner_id
                }
                isOwn={message.sender_id === user?.id}
              />
            </SwipeableRow>
          ))}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: tokens.surfaceElevated,
                color: tokens.textPrimary,
              },
            ]}
            value={draft}
            onChangeText={setDraft}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={tokens.textSecondary}
            multiline
            accessibilityLabel="Mesaj"
          />
          <TouchableOpacity
            style={[styles.send, { backgroundColor: tokens.accentPrimary }]}
            onPress={submit}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.sendText}>{t('chat.send')}</Text>
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
  // scroll={false} on GuestScreen means this styles the fixed outer column
  // directly (header + messages ScrollView + composer), not a ScrollView's
  // contentContainerStyle — see the JSX comment above. GuestScreen's own
  // scroll={true} branch applies its internal styles.content (which has
  // paddingHorizontal: gSpace.xl) automatically; the scroll={false} branch
  // does not, so it has to be repeated here — omitting it previously let
  // every child render edge-to-edge, misaligned with EventHeaderBar and the
  // floating tab bar above/below it (both use the same gSpace.xl margin).
  content: {
    paddingHorizontal: gSpace.xl,
    gap: gSpace.lg,
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
    gap: gSpace.lg,
    paddingBottom: gSpace.sm,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: gSpace.sm,
    marginTop: gSpace.md,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: gRadius.md,
    paddingHorizontal: gSpace.lg,
    paddingVertical: gSpace.md,
    fontSize: 14,
  },
  send: {
    height: 48,
    paddingHorizontal: gSpace.xl,
    borderRadius: gRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
