import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
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
import { SwipeableRow } from '@/components/SwipeableRow';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import { gRadius, gSpace } from '@/utils/guestTheme';
import { WEB_CONTENT_WIDTH } from '@/utils/webLayout';

export default function ChatScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { tokens } = useTheme();
  const { content, sendMessage, deleteMessage } = useEventContent(id);
  const [draft, setDraft] = useState('');

  const submit = () => {
    sendMessage(draft);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <GuestScreen contentStyle={styles.content} transparent webMaxWidth={WEB_CONTENT_WIDTH.narrow}>
        <View style={styles.headerBlock}>
          <SectionLabel>{t('chat.sectionLabel')}</SectionLabel>
          <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>{t('chat.subtitle')}</Text>
        </View>

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
            />
          </SwipeableRow>
        ))}

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
  content: {
    gap: gSpace.lg,
  },
  headerBlock: {
    gap: gSpace.xs,
  },
  subtitle: {
    fontSize: 13,
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
