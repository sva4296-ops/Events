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
import type { PickedPhoto } from '@/utils/imageProcessing';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';

const PRESET_EMOJI = ['💍', '👰', '🎂', '📸', '💐', '🥂', '✨', '💜'];

export default function PostMomentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);
  const { addMoment } = useEventContent(id ?? '');

  const [title, setTitle] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

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

    setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const post = () => {
    addMoment(title.trim(), photo);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        contentStyle={styles.content}
        footer={
          <Button
            label={t('postMomentForm.postButton')}
            disabled={title.trim().length === 0}
            icon={<Feather name="send" size={20} color={title.trim().length === 0 ? tokens.textMuted : tokens.onAccent} />}
            onPress={post}
          />
        }
      >
        <Header
          title=""
          flowTitle={t('postMomentForm.flowTitle')}
          stepLabel={event?.name}
          onClose={() => router.back()}
        />

        <TouchableOpacity
          style={[styles.picker, { backgroundColor: tokens.accentTint }]}
          onPress={() => void pickPhoto()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={photo === null ? t('postMomentForm.choosePhoto') : t('postMomentForm.changePhoto')}
        >
          {photo === null ? (
            <View style={styles.pickerEmpty}>
              <Feather name="image" size={28} color={tokens.accentText} />
              <Text style={[styles.pickerLabel, { color: tokens.accentText }]}>
                {t('postMomentForm.choosePhoto')}
              </Text>
            </View>
          ) : (
            <>
              <Image source={{ uri: photo.uri }} style={styles.preview} />
              <View style={styles.changeChip}>
                <Feather name="camera" size={16} color="#FFFFFF" />
                <Text style={styles.changeChipText}>{t('postMomentForm.changePhoto')}</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <Field
          label={t('postMomentForm.titleLabel')}
          value={title}
          onChangeText={setTitle}
          placeholder={t('postMomentForm.titlePlaceholder')}
        />

        <View style={styles.emojiBlock}>
          <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('postMomentForm.quickEmoji')}</Text>
          <View style={styles.emojiRow}>
            {PRESET_EMOJI.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiChip, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={() => setTitle((current) => `${current.trimEnd()} ${emoji}`.trim())}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Add ${emoji}`}
              >
                <Text style={styles.emoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  picker: {
    height: 200,
    borderRadius: 24,
    overflow: 'hidden',
  },
  pickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pickerLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  changeChip: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
    backgroundColor: 'rgba(30,26,48,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emojiBlock: {
    gap: 8,
  },
  label: {
    ...typography.label,
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emojiChip: {
    width: 50,
    height: 50,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
});
