import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEvents } from '@/hooks/useEvents';
import { useSpontaneous } from '@/hooks/useSpontaneous';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import type { BillSplit, SpontaneousContent } from '@/types/spontaneous';
import { confirmDelete } from '@/utils/confirm';
import { formatMoney } from '@/utils/money';
import { billPerPerson, spotsTaken } from '@/utils/spontaneous';
import { spacing } from '@/utils/theme';

/** Owner: set up or edit a spontaneous event's bill split. */
export default function BillFormScreen() {
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
        <Header title={t('spontaneous.bill.formTitle')} showBack />
      </Screen>
    );
  }
  return <BillForm event={event} content={content} existing={content.bill} />;
}

function BillForm({ event, content, existing }: { event: AppEvent; content: SpontaneousContent; existing: BillSplit | null }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { saveBill, removeBill } = useSpontaneous(event.id);
  const template = event.template ?? 'party';
  // Default head count: everyone coming (+1s) plus the host, or the spot limit.
  const defaultPeople = event.spotLimit ?? spotsTaken(content.attendees) + 1;
  const [title, setTitle] = useState(existing?.title ?? t(`spontaneous.templates.${template}.billTitle`));
  const [total, setTotal] = useState(existing !== null ? String(existing.totalAmount) : '');
  const [people, setPeople] = useState(String(existing?.peopleCount ?? Math.max(2, defaultPeople)));
  const [method, setMethod] = useState(existing?.paymentMethod ?? '');
  const [busy, setBusy] = useState(false);

  const amount = Number.parseFloat(total.replace(',', '.'));
  const count = Number.parseInt(people, 10);
  const valid = title.trim().length > 0 && Number.isFinite(amount) && amount > 0 && Number.isFinite(count) && count > 0 && !busy;
  const preview = valid
    ? billPerPerson({ eventId: event.id, title, totalAmount: amount, peopleCount: count, paymentMethod: method })
    : null;

  const save = async () => {
    setBusy(true);
    try {
      await saveBill({ title: title.trim(), totalAmount: amount, peopleCount: count, paymentMethod: method.trim() });
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
                label={t('spontaneous.bill.delete')}
                variant="danger"
                onPress={() =>
                  confirmDelete(t('spontaneous.bill.deleteTitle'), t('spontaneous.bill.deleteBody'), () => {
                    removeBill();
                    router.back();
                  })
                }
              />
            ) : null}
          </>
        }
      >
        <Header title={t('spontaneous.bill.formTitle')} subtitle={t('spontaneous.bill.formSubtitle')} showBack />

        <Field label={t('spontaneous.bill.titleLabel')} value={title} onChangeText={setTitle} />
        <Field
          label={t('spontaneous.bill.totalLabel')}
          value={total}
          onChangeText={setTotal}
          placeholder="960"
          keyboardType="numeric"
        />
        <Field
          label={t('spontaneous.bill.peopleLabel')}
          value={people}
          onChangeText={(value) => setPeople(value.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          hint={t('spontaneous.bill.peopleHint')}
        />
        <Field
          label={t('spontaneous.bill.methodLabel')}
          value={method}
          onChangeText={setMethod}
          placeholder={t('spontaneous.bill.methodPlaceholder')}
          multiline
        />
        {preview !== null ? (
          <Text style={[styles.preview, { color: tokens.textPrimary }]}>
            {t('spontaneous.bill.preview', { amount: formatMoney(preview, 'lei') })}
          </Text>
        ) : null}
        <Text style={[styles.note, { color: tokens.textSecondary }]}>{t('spontaneous.bill.noMoney')}</Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  preview: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: spacing.xs,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
  },
});
