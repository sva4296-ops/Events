import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { DateTimeField } from '@/components/DateTimeField';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { IconCircleButton } from '@/components/IconCircleButton';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useEventTasks } from '@/hooks/useEventTasks';
import { useTheme } from '@/hooks/useTheme';
import { confirmDelete } from '@/utils/confirm';
import { toTimeString } from '@/utils/dateInput';
import { formatEventDate } from '@/utils/format';
import { toIsoDate } from '@/utils/dateInput';
import { spacing } from '@/utils/theme';
import { ensureReminderPermission } from '@/utils/taskReminders';
import { REMINDER_OFFSETS } from '@/utils/taskTime';
import { themeRadius, typography } from '@/utils/themeTokens';

/** The next full hour from now (14:12 -> 15:00), the starting point when a due time is first picked. */
function defaultDue(): Date {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}

/** Today at local midnight: earlier days can't be picked. */
function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function TaskScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent } = useEvents();
  const event = getEvent(id);
  const { tasks, organizer, saveTask, deleteTask } = useEventTasks(id ?? '');

  const existing = tasks.find((task) => task.id === itemId) ?? null;
  const existingDue = existing?.dueAt != null ? new Date(existing.dueAt) : null;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [due, setDue] = useState<Date | null>(existingDue);
  // Minutes before the due time; null = no reminder.
  const [offset, setOffset] = useState<number | null>(
    existingDue !== null && existing?.remindAt != null
      ? Math.round((existingDue.getTime() - new Date(existing.remindAt).getTime()) / 60_000)
      : null,
  );
  const [saving, setSaving] = useState(false);

  if (!organizer) {
    return (
      <Screen coverType={event?.type}>
        <Header title={t('common.notAvailable')} subtitle={t('checklist.notAvailable')} showBack />
      </Screen>
    );
  }

  const setDay = (picked: Date) => {
    const next = new Date(due ?? defaultDue());
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    setDue(next);
  };

  const setTime = (picked: Date) => {
    const next = new Date(due ?? defaultDue());
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    setDue(next);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const remindAt = due !== null && offset !== null ? new Date(due.getTime() - offset * 60_000) : null;
    if (remindAt !== null) await ensureReminderPermission();
    await saveTask({
      id: existing?.id ?? null,
      title: title.trim(),
      dueAt: due?.toISOString() ?? null,
      remindAt: remindAt?.toISOString() ?? null,
    });
    router.back();
  };

  const reminderLabel = (minutes: number) => t(`checklist.remind_${minutes}`);

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen
        coverType={event?.type}
        footer={
          <Button
            label={existing === null ? t('checklist.add') : t('common.saveChanges')}
            disabled={title.trim().length === 0 || saving}
            onPress={() => void save()}
          />
        }
      >
        <Header
          title={existing === null ? t('checklist.addTitle') : t('checklist.editTitle')}
          subtitle={t('checklist.formSubtitle')}
          showBack
          right={
            existing !== null ? (
              <IconCircleButton
                icon="trash-2"
                tone="destructive"
                accessibilityLabel={t('common.delete')}
                onPress={() =>
                  confirmDelete(t('checklist.deleteTitle'), t('checklist.deleteBody', { title: existing.title }), async () => {
                    await deleteTask(existing.id);
                    router.back();
                  })
                }
              />
            ) : undefined
          }
        />

        <Field
          label={t('checklist.titleLabel')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('checklist.titlePlaceholder')}
          maxLength={200}
        />

        <DateTimeField
          label={t('checklist.dateLabel')}
          mode="date"
          value={due ?? defaultDue()}
          displayValue={due === null ? t('checklist.noDate') : formatEventDate(toIsoDate(due))}
          onChange={setDay}
          minimumDate={startOfToday()}
        />

        {due !== null ? (
          <>
            <DateTimeField
              label={t('checklist.timeLabel')}
              mode="time"
              value={due}
              displayValue={toTimeString(due)}
              onChange={setTime}
            />
            <TouchableOpacity
              onPress={() => {
                setDue(null);
                setOffset(null);
              }}
              activeOpacity={0.7}
              hitSlop={8}
              accessibilityRole="button"
              style={styles.clear}
            >
              <Text style={[styles.clearText, { color: tokens.accentText }]}>{t('checklist.clearDate')}</Text>
            </TouchableOpacity>

            <View style={styles.section}>
              <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('checklist.reminderLabel')}</Text>
              <View style={styles.pillRow}>
                {[null, ...REMINDER_OFFSETS].map((minutes) => {
                  const active = offset === minutes;
                  return (
                    <TouchableOpacity
                      key={minutes ?? 'none'}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: active ? tokens.accentTint : tokens.surface,
                          borderColor: active ? tokens.accentPrimary : tokens.border,
                        },
                      ]}
                      onPress={() => setOffset(minutes)}
                      activeOpacity={0.75}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.pillText, { color: active ? tokens.accentText : tokens.textPrimary }]}>
                        {minutes === null ? t('checklist.remindNone') : reminderLabel(minutes)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {offset !== null ? (
                <Text style={[styles.hint, { color: tokens.textSecondary }]}>
                  {t('checklist.reminderHint', { time: toTimeString(new Date(due.getTime() - offset * 60_000)) })}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  clear: {
    alignSelf: 'flex-start',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    ...typography.label,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 4,
    justifyContent: 'center',
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
