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

export default function VendorScreen() {
  const { t } = useTranslation();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveVendor } = useEventContent(id ?? '');

  const existing = content?.vendors.find((vendor) => vendor.id === itemId) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [handle, setHandle] = useState(existing?.handle ?? '');
  const [externalUrl, setExternalUrl] = useState(existing?.external_url ?? '');

  if (!isOwner(event) || content === null) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('vendorForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const save = () => {
    saveVendor({
      id: existing?.id ?? null,
      name: name.trim(),
      category,
      handle,
      external_url: externalUrl.trim(),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button
            label={existing === null ? t('vendorForm.addButton') : t('common.saveChanges')}
            disabled={name.trim().length === 0}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? t('vendorForm.addTitle') : t('vendorForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
        />

        <Field
          label={t('vendorForm.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('vendorForm.namePlaceholder')}
        />
        <Field
          label={t('vendorForm.categoryLabel')}
          value={category}
          onChangeText={setCategory}
          placeholder={t('vendorForm.categoryPlaceholder')}
        />
        <Field
          label={t('vendorForm.handleLabel')}
          value={handle}
          onChangeText={setHandle}
          placeholder={t('vendorForm.handlePlaceholder')}
        />
        <Field
          label={t('vendorForm.linkLabel')}
          value={externalUrl}
          onChangeText={setExternalUrl}
          placeholder={t('vendorForm.linkPlaceholder')}
          keyboardType="default"
          hint={t('vendorForm.linkHint')}
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
