import { useState } from 'react';
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
import { MessageBubble } from '@/components/guest/MessageBubble';
import { SectionLabel } from '@/components/guest/SectionLabel';
import { SwipeableRow } from '@/components/SwipeableRow';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';

export default function ChatScreen() {
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { content, sendMessage, deleteMessage } = useEventContent(id);
  const [draft, setDraft] = useState('');

  const submit = () => {
    sendMessage(draft);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <GuestScreen contentStyle={styles.content} transparent>
        <View style={styles.headerBlock}>
          <SectionLabel>GRUPUL NUNȚII</SectionLabel>
          <Text style={styles.subtitle}>Invitații vorbesc între ei și cu organizatorul</Text>
        </View>

        {content !== null && content.messages.length === 0 ? (
          <EmptyState message="Niciun mesaj încă. Scrie primul!" />
        ) : null}

        {content?.messages.map((message) => (
          <SwipeableRow
            key={message.id}
            // Only your own messages swipe; everyone else's stay static.
            enabled={message.sender_id === user?.id}
            actions={[
              {
                label: 'Șterge',
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
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Scrie un mesaj…"
            placeholderTextColor={guest.faint}
            multiline
            accessibilityLabel="Mesaj"
          />
          <TouchableOpacity
            style={styles.send}
            onPress={submit}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.sendText}>Trimite</Text>
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
    color: guest.body,
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
    backgroundColor: guest.white,
    borderRadius: gRadius.md,
    paddingHorizontal: gSpace.lg,
    paddingVertical: gSpace.md,
    fontSize: 14,
    color: guest.ink,
    ...gShadow,
  },
  send: {
    height: 48,
    paddingHorizontal: gSpace.xl,
    borderRadius: gRadius.md,
    backgroundColor: guest.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...gShadow,
  },
  sendText: {
    fontSize: 14,
    fontWeight: '700',
    color: guest.white,
  },
});
