import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import { ActivityIndicator, Alert, AppState, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { BackButton } from '@/components/BackButton';
import { ListGroup, ListRow } from '@/components/ListGroup';
import { Screen } from '@/components/Screen';
import { ToggleSwitch } from '@/components/Toggle';
import { useAgency } from '@/hooks/useAgency';
import { useAuth } from '@/hooks/useAuth';
import { GeneratedAvatar } from '@/components/GeneratedAvatar';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatPhoneDisplay } from '@/utils/countryCodes';
import { processAvatarPhoto } from '@/utils/imageProcessing';
import { disablePushNotifications, enablePushNotifications, isPushActive } from '@/utils/pushNotifications';
import { reportSupabaseError } from '@/utils/reportError';
import { spacing } from '@/utils/theme';
import { themeRadius, typography } from '@/utils/themeTokens';
import { INVITE_SITE_URL } from '@/utils/whatsappInvite';
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
  const { user, signOut, deleteAccount } = useAuth();
  const { displayName, avatarUrl, uploadAvatar } = useUserProfile();
  const { isAgencyOwner, hydrated: agencyHydrated } = useAgency();
  const { tokens, mode, setThemeMode } = useTheme();
  const activeLanguage = i18n.language;
  const contact = user?.email ?? user?.phone ?? null;
  const phoneDisplay = user?.phone != null ? formatPhoneDisplay(user.phone) : null;

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const refreshPush = useCallback(() => {
    void isPushActive().then(setPushEnabled);
  }, []);

  // Also on return from the system Settings app, where permission may have changed.
  useEffect(() => {
    refreshPush();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPush();
    });
    return () => subscription.remove();
  }, [refreshPush]);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    if (pushEnabled) {
      setPushEnabled(false);
      await disablePushNotifications();
    } else {
      const result = await enablePushNotifications();
      setPushEnabled(result === 'enabled');
      if (result === 'blocked') {
        Alert.alert(t('profile.notificationsBlockedTitle'), t('profile.notificationsBlockedMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('profile.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
      }
    }
    setPushBusy(false);
  };

  const runDeleteAccount = async () => {
    setDeletingAccount(true);
    const error = await deleteAccount();
    if (error !== null) {
      setDeletingAccount(false);
      Alert.alert(t('profile.deleteAccountFailed'), error);
    }
    // On success AuthGate sees the session drop and routes to /auth.
  };

  const confirmDeleteAccount = () => {
    Alert.alert(t('profile.deleteAccountTitle'), t('profile.deleteAccountMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccountConfirm'),
        style: 'destructive',
        onPress: () => void runDeleteAccount(),
      },
    ]);
  };

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

  const initials = (displayName ?? '')
    .split(' ')
    .map((part) => part.trim().charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const chooseLanguage = () => {
    Alert.alert(t('profile.language'), undefined, [
      ...SUPPORTED_LANGUAGES.map((language) => ({
        text: t(LANGUAGE_LABEL_KEY[language]),
        onPress: () => void setLanguage(language),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const chooseTheme = () => {
    Alert.alert(t('profile.theme'), undefined, [
      ...THEME_MODES.map((themeMode) => ({
        text: t(THEME_LABEL_KEY[themeMode]),
        onPress: () => setThemeMode(themeMode),
      })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  const languageLabel = SUPPORTED_LANGUAGES.includes(activeLanguage as SupportedLanguage)
    ? t(LANGUAGE_LABEL_KEY[activeLanguage as SupportedLanguage])
    : activeLanguage;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <BackButton />
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('profile.title')}</Text>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onPress={() => router.push('/edit-profile')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('profile.editProfile')}
        >
          <Feather name="edit-2" size={20} color={tokens.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.identity}>
        <TouchableOpacity
          onPress={chooseAvatarSource}
          disabled={uploadingAvatar}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePhoto')}
        >
          {avatarUrl !== null ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <GeneratedAvatar seed={user?.id ?? initials} size={72} />
          )}
          {uploadingAvatar ? (
            <View style={[styles.avatar, styles.avatarOverlay]}>
              <ActivityIndicator color="#FFFFFF" size="small" />
            </View>
          ) : (
            <View style={[styles.avatarBadge, { backgroundColor: tokens.accentFill, borderColor: tokens.surface }]}>
              <Feather name="camera" size={12} color={tokens.onAccent} />
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.info}>
          <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
            {displayName ?? contact ?? t('profile.title')}
          </Text>
          {phoneDisplay !== null ? (
            <Text style={[styles.meta, { color: tokens.textSecondary }]}>{phoneDisplay}</Text>
          ) : null}
        </View>
      </View>

      <ListGroup title={t('profile.groupAccount')}>
        <ListRow icon="user" label={t('profile.personalData')} onPress={() => router.push('/edit-profile')} />
        <ListRow icon="globe" label={t('profile.language')} value={languageLabel} onPress={chooseLanguage} />
        <ListRow icon="moon" label={t('profile.theme')} value={t(THEME_LABEL_KEY[mode])} onPress={chooseTheme} />
        <ListRow
          icon="bell"
          label={t('profile.notifications')}
          trailing={<ToggleSwitch value={pushEnabled} />}
          onPress={() => void togglePush()}
        />
      </ListGroup>

      {agencyHydrated ? (
        <ListGroup title={t('profile.groupEvents')}>
          <ListRow
            icon="briefcase"
            label={t('profile.agencyAccount')}
            trailing={
              isAgencyOwner ? (
                <View style={[styles.badge, { backgroundColor: tokens.textPrimary }]}>
                  <Text style={[styles.badgeText, { color: tokens.surface }]}>{t('profile.agencyBadge')}</Text>
                </View>
              ) : undefined
            }
            onPress={isAgencyOwner ? undefined : () => router.push('/agency-signup')}
          />
        </ListGroup>
      ) : null}

      <ListGroup title={t('profile.groupHelp')}>
        <ListRow
          icon="file-text"
          label={t('profile.terms')}
          onPress={() => void Linking.openURL(`${INVITE_SITE_URL}/termeni`)}
        />
      </ListGroup>

      {user !== null ? (
        <Button
          label={t('profile.signOut')}
          variant="secondary"
          icon={<Feather name="log-out" size={20} color={tokens.textPrimary} />}
          onPress={() => void signOut()}
        />
      ) : null}

      {user !== null ? (
        <TouchableOpacity
          style={styles.deleteAccount}
          onPress={confirmDeleteAccount}
          disabled={deletingAccount}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('profile.deleteAccount')}
        >
          {deletingAccount ? (
            <ActivityIndicator color={tokens.destructive} size="small" />
          ) : (
            <Text style={[styles.deleteAccountText, { color: tokens.destructive }]}>{t('profile.deleteAccount')}</Text>
          )}
        </TouchableOpacity>
      ) : null}

      <Text style={[styles.version, { color: tokens.textSecondary }]}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '' })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 22,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: spacing.lg,
  },
  title: {
    ...typography.title1,
    fontSize: 30,
    lineHeight: 36,
    flex: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '600',
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    ...typography.title2,
  },
  meta: {
    fontSize: 14,
  },
  badge: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteAccount: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteAccountText: {
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
  },
});
