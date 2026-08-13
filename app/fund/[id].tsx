import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';

export default function FundFormScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveFund } = useEventContent(id ?? '');

  const existing = content?.fund ?? null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [target, setTarget] = useState(existing === null ? '' : String(existing.target_amount));
  const [currency, setCurrency] = useState(existing?.currency ?? 'RON');

  if (!isOwner(event)) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('fundForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const amount = Number.parseFloat(target.replace(',', '.'));
  const valid = title.trim().length > 0 && Number.isFinite(amount) && amount > 0;

  const save = () => {
    saveFund({
      title: title.trim(),
      description: description.trim(),
      target_amount: amount,
      currency: currency.trim().toUpperCase(),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        footer={
          <Button
            label={existing === null ? t('fundForm.setupButton') : t('fundForm.saveButton')}
            disabled={!valid}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? t('fundForm.setupTitle') : t('fundForm.editTitle')}
          subtitle={t('fundForm.guestsSeeOnFond')}
          showBack
        />

        <Field
          label={t('fundForm.titleLabel')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('fundForm.titlePlaceholder')}
        />
        <Field
          label={t('fundForm.descriptionLabel')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('fundForm.descriptionPlaceholder')}
          multiline
        />
        <Field
          label={t('fundForm.targetLabel')}
          value={target}
          onChangeText={setTarget}
          placeholder={t('fundForm.targetPlaceholder')}
          keyboardType="numeric"
        />
        <Field
          label={t('fundForm.currencyLabel')}
          value={currency}
          onChangeText={setCurrency}
          placeholder={t('fundForm.currencyPlaceholder')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
