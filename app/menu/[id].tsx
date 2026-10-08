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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { showActionSheet } from '@/components/ActionSheet';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { FocusRing } from '@/components/FocusRing';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent, type MenuCoursePhotoInput } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { haptics } from '@/utils/haptics';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';
import { generateId } from '@/utils/uuid';

const MAX_COURSES = 8;

interface CourseDraft {
  /** Local list key only, never saved. */
  key: string;
  name: string;
  dish: string;
  photo: MenuCoursePhotoInput;
  /** What the thumbnail shows: the signed URL of a saved photo, or the picked local file. */
  previewUri: string | null;
}

/** Owner: add or edit one menu option (`?itemId=` for edit). */
export default function MenuScreen() {
  const { t } = useTranslation();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isVenueManager } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);
  const { content, saveMenuOption } = useEventContent(id ?? '');

  const existing = content?.menuOptions.find((option) => option.id === itemId) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [courses, setCourses] = useState<CourseDraft[]>(() =>
    existing !== null && existing.courses.length > 0
      ? existing.courses.map((course) => ({
          key: generateId(),
          name: course.name,
          dish: course.dish,
          photo: course.photo_path !== null ? { kind: 'keep' as const, path: course.photo_path } : null,
          previewUri: course.photo_url,
        }))
      : [
          { key: generateId(), name: t('detalii.courseStarter'), dish: '', photo: null, previewUri: null },
          { key: generateId(), name: t('detalii.courseMain'), dish: '', photo: null, previewUri: null },
          { key: generateId(), name: t('detalii.courseDessert'), dish: '', photo: null, previewUri: null },
        ],
  );
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  if (!isVenueManager(event) || content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('menuForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const updateCourse = (key: string, patch: Partial<CourseDraft>) =>
    setCourses((current) => current.map((course) => (course.key === key ? { ...course, ...patch } : course)));

  const addCourse = () => {
    haptics.tap();
    setCourses((current) =>
      current.length >= MAX_COURSES
        ? current
        : [...current, { key: generateId(), name: '', dish: '', photo: null, previewUri: null }],
    );
  };

  const removeCourse = (key: string) => {
    haptics.tap();
    setCourses((current) => current.filter((course) => course.key !== key));
  };

  const pickCoursePhoto = async (key: string) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    const asset = result.assets?.[0];
    if (result.canceled || asset === undefined) return;
    updateCourse(key, {
      photo: { kind: 'new', picked: { uri: asset.uri, width: asset.width, height: asset.height } },
      previewUri: asset.uri,
    });
  };

  const onCoursePhotoPress = (course: CourseDraft) => {
    haptics.tap();
    if (course.photo === null) {
      void pickCoursePhoto(course.key);
      return;
    }
    showActionSheet({
      title: t('menuForm.coursePhotoTitle'),
      actions: [
        { label: t('menuForm.coursePhotoChange'), icon: 'image', onPress: () => void pickCoursePhoto(course.key) },
        {
          label: t('menuForm.coursePhotoRemove'),
          tone: 'delete',
          onPress: () => updateCourse(course.key, { photo: null, previewUri: null }),
        },
      ],
    });
  };

  // Placeholders for the three default rows of a new menu; anything else gets a generic one.
  const dishPlaceholder = (index: number) =>
    existing === null && index < 3
      ? [t('menuForm.starterPlaceholder'), t('menuForm.mainPlaceholder'), t('menuForm.dessertPlaceholder')][index]
      : t('menuForm.dishPlaceholder');

  const save = () => {
    saveMenuOption({
      id: existing?.id ?? null,
      name: name.trim(),
      courses: courses
        .filter((course) => course.dish.trim().length > 0)
        .map((course, index) => ({
          name: course.name.trim().length > 0 ? course.name.trim() : t('menuForm.courseFallback', { n: index + 1 }),
          dish: course.dish.trim(),
          photo: course.photo,
        })),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        coverType={event?.type}
        footer={<Button label={t('menuForm.saveButton')} disabled={name.trim().length === 0} onPress={save} />}
      >
        <Header
          title={existing === null ? t('menuForm.addTitle') : t('menuForm.editTitle')}
          subtitle={t('menuForm.subtitle')}
          showBack
        />

        <Field
          label={t('menuForm.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('menuForm.namePlaceholder')}
        />

        {courses.map((course, index) => (
          <View key={course.key} style={styles.course}>
            <View style={styles.courseHeader}>
              <TextInput
                style={[styles.courseName, { color: tokens.textSecondary }]}
                value={course.name}
                onChangeText={(value) => updateCourse(course.key, { name: value })}
                placeholder={t('menuForm.courseNamePlaceholder', { n: index + 1 })}
                placeholderTextColor={tokens.textMuted}
                accessibilityLabel={t('menuForm.courseNameA11y', { n: index + 1 })}
              />
              <Feather name="edit-3" size={12} color={tokens.textMuted} />
              <View style={styles.spacer} />
              {courses.length > 1 ? (
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeCourse(course.key)}
                  activeOpacity={0.7}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t('menuForm.removeCourse', { name: course.name || index + 1 })}
                >
                  <Feather name="x" size={16} color={tokens.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={styles.dishRow}>
              <FocusRing active={focusedKey === course.key} style={styles.dishField}>
                <View
                  style={[
                    styles.box,
                    {
                      backgroundColor: tokens.surface,
                      borderColor: focusedKey === course.key ? tokens.accentPrimary : tokens.border,
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { color: tokens.textPrimary }]}
                    value={course.dish}
                    onChangeText={(value) => updateCourse(course.key, { dish: value })}
                    onFocus={() => setFocusedKey(course.key)}
                    onBlur={() => setFocusedKey((current) => (current === course.key ? null : current))}
                    placeholder={dishPlaceholder(index)}
                    placeholderTextColor={tokens.textMuted}
                    accessibilityLabel={course.name || t('menuForm.courseNamePlaceholder', { n: index + 1 })}
                  />
                </View>
              </FocusRing>
              <TouchableOpacity
                style={[styles.photoButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
                onPress={() => onCoursePhotoPress(course)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={
                  course.photo === null ? t('menuForm.coursePhotoAdd') : t('menuForm.coursePhotoTitle')
                }
              >
                {course.previewUri !== null ? (
                  <Image source={{ uri: course.previewUri }} style={styles.photoThumb} />
                ) : (
                  <Feather name="camera" size={20} color={tokens.textSecondary} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {courses.length < MAX_COURSES ? (
          <TouchableOpacity
            style={[styles.addCourse, { borderColor: tokens.accentPrimary }]}
            onPress={addCourse}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('menuForm.addCourse')}
          >
            <Feather name="plus" size={18} color={tokens.accentText} />
            <Text style={[styles.addCourseText, { color: tokens.accentText }]}>{t('menuForm.addCourse')}</Text>
          </TouchableOpacity>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  course: {
    gap: spacing.sm,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  courseName: {
    ...typography.label,
    minWidth: 60,
    paddingVertical: 2,
  },
  spacer: {
    flex: 1,
  },
  removeButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: themeRadius.md,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: spacing.md,
  },
  dishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dishField: {
    flex: 1,
  },
  photoButton: {
    width: 54,
    height: 54,
    borderRadius: themeRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  addCourse: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    borderRadius: themeRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addCourseText: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
});
