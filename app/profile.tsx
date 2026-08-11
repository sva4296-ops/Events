import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { useTheme, type ThemeMode } from '@/hooks/useTheme';
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
  const { tokens, mode, setThemeMode } = useTheme();
  const activeLanguage = i18n.language;

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
          <View style={[styles.avatar, { backgroundColor: `${tokens.accentPrimary}22` }]}>
            <Feather name="user" size={20} color={tokens.accentPrimary} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.email, { color: tokens.textPrimary }]}>
              {user?.email ?? t('profile.title')}
            </Text>
            <Text style={[styles.meta, { color: tokens.textSecondary }]}>
              {t('profile.signedInWithSupabase')}
            </Text>
          </View>
        </View>
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
    borderRadius: themeRadius.pill,
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
