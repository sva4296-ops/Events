import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';

export default function MenuScreen() {
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
        <Header title="Not available" subtitle="Only the organizer can edit the menu." showBack />
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
      <Screen footer={<Button label="Save menu" disabled={!valid} onPress={save} />}>
        <Header
          title={content.menu === null ? 'Set the menu' : 'Edit the menu'}
          subtitle="Guests will see this on the Detalii tab."
          showBack
        />

        <Field
          label="Antreu"
          value={starter}
          onChangeText={setStarter}
          placeholder="Supă cremă de dovleac"
        />
        <Field
          label="Fel principal"
          value={main}
          onChangeText={setMain}
          placeholder="Piept de rață cu piure de cartofi"
        />
        <Field label="Desert" value={dessert} onChangeText={setDessert} placeholder="Tort de ciocolată" />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
