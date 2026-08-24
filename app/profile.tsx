import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useAgency } from '@/hooks/useAgency';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatPhoneDisplay } from '@/utils/countryCodes';
import { processAvatarPhoto } from '@/utils/imageProcessing';
import { reportSupabaseError } from '@/utils/reportError';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/utils/i18n';

const LANGUAGE_LABEL_KEY: Record<SupportedLanguage, string> = {
  en: 'profile.languageEnglish',
  ro: 'profile.languageRomanian',
};

const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'];

const THEME_LABEL_KEY: Record<ThemeMode, string> = {
  light: 'profile.themeLight',
  dark: 'profile.themeDark',
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { displayName, avatarUrl, uploadAvatar } = useUserProfile();
  const { isAgencyOwner, hydrated: agencyHydrated } = useAgency();
  const { tokens, mode, setThemeMode } = useTheme();
  const activeLanguage = i18n.language;
  const contact = user?.email ?? user?.phone ?? null;
  const phoneDisplay = user?.phone != null ? formatPhoneDisplay(user.phone) : null;

  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickAndUploadAvatar = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    };
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(pickerOptions)
        : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    const asset = result.assets?.[0];
    if (result.canceled || asset === undefined) return;

    setUploadingAvatar(true);
    try {
      const processedUri = await processAvatarPhoto({
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      });
      await uploadAvatar(processedUri);
    } catch (err) {
      reportSupabaseError(err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const chooseAvatarSource = () => {
    Alert.alert(t('profile.changePhoto'), undefined, [
      { text: t('profile.takePhoto'), onPress: () => void pickAndUploadAvatar('camera') },
      { text: t('profile.chooseFromLibrary'), onPress: () => void pickAndUploadAvatar('library') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  return (
    <Screen
      footer={
        user !== null ? (
          <Button label={t('profile.signOut')} variant="secondary" onPress={() => void signOut()} />
        ) : undefined
      }
    >
      <Header title={t('profile.title')} subtitle={t('profile.subtitle')} showBack />

      <Card>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={chooseAvatarSource}
            disabled={uploadingAvatar}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('profile.changePhoto')}
          >
            <View style={[styles.avatarInner, { backgroundColor: `${tokens.accentPrimary}22` }]}>
              {avatarUrl !== null ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={20} color={tokens.accentPrimary} />
              )}
              {uploadingAvatar ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#FFFFFF" size="small" />
                </View>
              ) : null}
            </View>
            {uploadingAvatar ? null : (
              <View
                style={[
                  styles.avatarBadge,
                  { backgroundColor: tokens.accentPrimary, borderColor: tokens.surfaceElevated },
                ]}
              >
                <Feather name="camera" size={10} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.info}>
            <Text style={[styles.email, { color: tokens.textPrimary }]}>
              {displayName ?? contact ?? t('profile.title')}
            </Text>
            <Text style={[styles.meta, { color: tokens.textSecondary }]}>
              {phoneDisplay ?? t('profile.signedInWithSupabase')}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.profileActionRow, { borderTopColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)' }]}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Feather name="edit-2" size={18} color={tokens.textSecondary} />
          <Text style={[styles.profileActionLabel, { color: tokens.textPrimary }]}>
            {t('profile.editProfile')}
          </Text>
          <Feather name="chevron-right" size={18} color={tokens.textSecondary} />
        </TouchableOpacity>

        {agencyHydrated && !isAgencyOwner ? (
          <TouchableOpacity
            style={[styles.profileActionRow, { borderTopColor: tokens.surfaceBorder ?? 'rgba(0,0,0,0.06)' }]}
            onPress={() => router.push('/agency-signup')}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <Feather name="briefcase" size={18} color={tokens.textSecondary} />
            <Text style={[styles.profileActionLabel, { color: tokens.textPrimary }]}>
              {t('profile.addBusinessAccount')}
            </Text>
            <Feather name="chevron-right" size={18} color={tokens.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </Card>

      <Card style={styles.languageCard}>
        <Text style={[styles.languageLabel, { color: tokens.textSecondary }]}>
          {t('profile.language')}
        </Text>
        <View style={styles.languageOptions}>
          {SUPPORTED_LANGUAGES.map((language) => {
            const active = activeLanguage === language;
            return (
              <TouchableOpacity
                key={language}
                style={[
                  styles.languageOption,
                  {
                    borderColor: active ? tokens.accentPrimary : tokens.surfaceBorder ?? 'rgba(0,0,0,0.1)',
                    backgroundColor: active ? tokens.accentPrimary : tokens.surface,
                  },
                ]}
                onPress={() => void setLanguage(language)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    { color: active ? '#FFFFFF' : tokens.textPrimary },
                  ]}
                >
                  {t(LANGUAGE_LABEL_KEY[language])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>

      <Card style={styles.languageCard}>
        <Text style={[styles.languageLabel, { color: tokens.textSecondary }]}>
          {t('profile.theme')}
        </Text>
        <View style={styles.languageOptions}>
          {THEME_MODES.map((themeMode) => {
            const active = mode === themeMode;
            return (
              <TouchableOpacity
                key={themeMode}
                style={[
                  styles.languageOption,
                  {
                    borderColor: active ? tokens.accentPrimary : tokens.surfaceBorder ?? 'rgba(0,0,0,0.1)',
                    backgroundColor: active ? tokens.accentPrimary : tokens.surface,
                  },
                ]}
                onPress={() => setThemeMode(themeMode)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    { color: active ? '#FFFFFF' : tokens.textPrimary },
                  ]}
                >
                  {t(THEME_LABEL_KEY[themeMode])}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 46,
    height: 46,
  },
  avatarInner: {
    width: 46,
    height: 46,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: themeRadius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  email: {
    fontSize: 15,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
  },
  profileActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
  },
  profileActionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  languageCard: {
    gap: spacing.md,
  },
  languageLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  languageOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  languageOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: themeRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
