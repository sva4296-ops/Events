import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useSpontaneous } from '@/hooks/useSpontaneous';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import type { EventPoll, PollOption } from '@/types/spontaneous';
import { confirmDelete } from '@/utils/confirm';
import { generateId } from '@/utils/uuid';

const MAX_OPTIONS = 6;

/** Owner: create or edit a spontaneous event's group vote (one per event). */
export default function PollFormScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content } = useSpontaneous(id ?? '');

  if (event === undefined || !isOwner(event)) {
    return (
      <Screen>
        <Header title={t('common.notAvailable')} showBack />
      </Screen>
    );
  }
  if (content === null) {
    return (
      <Screen>
        <Header title={t('spontaneous.poll.formTitle')} showBack />
      </Screen>
    );
  }
  return <PollForm event={event} existing={content.poll} />;
}

function PollForm({ event, existing }: { event: AppEvent; existing: EventPoll | null }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { savePoll, removePoll } = useSpontaneous(event.id);
  const template = event.template ?? 'party';
  const [question, setQuestion] = useState(
    existing?.question ?? t(`spontaneous.templates.${template}.pollQuestion`),
  );
  const [options, setOptions] = useState<PollOption[]>(
    existing?.options ??
      (t(`spontaneous.templates.${template}.pollOptions`, { returnObjects: true }) as string[]).map((label) => ({
        id: generateId().slice(0, 8),
        label,
      })),
  );
  const [busy, setBusy] = useState(false);

  const filled = options.filter((option) => option.label.trim().length > 0);
  const valid = question.trim().length > 0 && filled.length >= 2 && !busy;

  const save = async () => {
    setBusy(true);
    try {
      await savePoll(
        question.trim(),
        filled.map((option) => ({ id: option.id, label: option.label.trim() })),
      );
      router.back();
    } catch {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        coverType={event.type}
        footer={
          <>
            <Button label={t('common.saveChanges')} disabled={!valid} onPress={() => void save()} />
            {existing !== null ? (
              <Button
                label={t('spontaneous.poll.delete')}
                variant="danger"
                onPress={() =>
                  confirmDelete(t('spontaneous.poll.deleteTitle'), t('spontaneous.poll.deleteBody'), () => {
                    removePoll();
                    router.back();
                  })
                }
              />
            ) : null}
          </>
        }
      >
        <Header title={t('spontaneous.poll.formTitle')} subtitle={t('spontaneous.poll.formSubtitle')} showBack />

        <Field
          label={t('spontaneous.poll.questionLabel')}
          value={question}
          onChangeText={setQuestion}
          placeholder={t('spontaneous.poll.questionPlaceholder')}
        />
        {options.map((option, index) => (
          <View key={option.id} style={styles.optionRow}>
            <View style={styles.optionField}>
              <Field
                label={t('spontaneous.poll.optionLabel', { number: index + 1 })}
                value={option.label}
                onChangeText={(label) =>
                  setOptions((current) => current.map((o) => (o.id === option.id ? { ...o, label } : o)))
                }
                placeholder={t('spontaneous.poll.optionPlaceholder')}
              />
            </View>
            {options.length > 2 ? (
              <TouchableOpacity
                onPress={() => setOptions((current) => current.filter((o) => o.id !== option.id))}
                accessibilityRole="button"
                accessibilityLabel={t('spontaneous.poll.removeOption')}
                hitSlop={8}
                style={styles.remove}
              >
                <Feather name="x" size={20} color={tokens.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ))}
        {options.length < MAX_OPTIONS ? (
          <Button
            label={t('spontaneous.poll.addOption')}
            variant="ghost"
            onPress={() => setOptions((current) => [...current, { id: generateId().slice(0, 8), label: '' }])}
          />
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  optionField: {
    flex: 1,
  },
  remove: {
    height: 52,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
