import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

const PRESET_EMOJI = ['💍', '👰', '🎂', '📸', '💐', '🥂', '✨', '💜'];

export default function PostMomentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);
  const { addMoment } = useEventContent(id ?? '');

  const [title, setTitle] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  if (!isOwner(event)) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('postMomentForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || asset === undefined) return;

    setPhotoUri(asset.uri);
  };

  const post = () => {
    addMoment(title.trim(), photoUri ?? '');
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        footer={
          <Button label={t('postMomentForm.postButton')} disabled={title.trim().length === 0} onPress={post} />
        }
      >
        <Header
          title={t('postMomentForm.title')}
          subtitle={t('postMomentForm.subtitle')}
          showBack
        />

        <Field
          label={t('postMomentForm.titleLabel')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('postMomentForm.titlePlaceholder')}
        />

        <View style={styles.emojiRow}>
          {PRESET_EMOJI.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.emojiChip,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.1)',
                },
              ]}
              onPress={() => setTitle((current) => `${current.trimEnd()} ${emoji}`.trim())}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Add ${emoji}`}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.picker,
            {
              backgroundColor: tokens.surface,
              borderColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.1)',
            },
          ]}
          onPress={() => void pickPhoto()}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          {photoUri === null ? (
            <View style={styles.pickerEmpty}>
              <Feather name="image" size={22} color={tokens.accentPrimary} />
              <Text style={[styles.pickerLabel, { color: tokens.accentPrimary }]}>
                {t('postMomentForm.choosePhoto')}
              </Text>
            </View>
          ) : (
            <Image source={{ uri: photoUri }} style={styles.preview} />
          )}
        </TouchableOpacity>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  picker: {
    borderRadius: themeRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  pickerEmpty: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    height: 200,
  },
});
