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

export default function MenuScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const { content, saveMenu } = useEventContent(id ?? '');

  const [starter, setStarter] = useState(content?.menu?.starter ?? '');
  const [main, setMain] = useState(content?.menu?.main ?? '');
  const [dessert, setDessert] = useState(content?.menu?.dessert ?? '');

  if (!isOwner(event) || content === null) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('menuForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const valid = starter.trim().length > 0 || main.trim().length > 0 || dessert.trim().length > 0;

  const save = () => {
    saveMenu({ starter, main, dessert });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen footer={<Button label={t('menuForm.saveButton')} disabled={!valid} onPress={save} />}>
        <Header
          title={content.menu === null ? t('menuForm.setTitle') : t('menuForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
        />

        <Field
          label={t('detalii.courseStarter')}
          value={starter}
          onChangeText={setStarter}
          placeholder={t('menuForm.starterPlaceholder')}
        />
        <Field
          label={t('detalii.courseMain')}
          value={main}
          onChangeText={setMain}
          placeholder={t('menuForm.mainPlaceholder')}
        />
        <Field
          label={t('detalii.courseDessert')}
          value={dessert}
          onChangeText={setDessert}
          placeholder={t('menuForm.dessertPlaceholder')}
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
