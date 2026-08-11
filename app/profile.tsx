import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/hooks/useAuth';
import { colors, radius, spacing } from '@/utils/theme';
import { setLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/utils/i18n';

const LANGUAGE_LABEL_KEY: Record<SupportedLanguage, string> = {
  en: 'profile.languageEnglish',
  ro: 'profile.languageRomanian',
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
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
          <View style={styles.avatar}>
            <Feather name="user" size={20} color={colors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.email}>{user?.email ?? t('profile.title')}</Text>
            <Text style={styles.meta}>{t('profile.signedInWithSupabase')}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.languageCard}>
        <Text style={styles.languageLabel}>{t('profile.language')}</Text>
        <View style={styles.languageOptions}>
          {SUPPORTED_LANGUAGES.map((language) => {
            const active = activeLanguage === language;
            return (
              <TouchableOpacity
                key={language}
                style={[styles.languageOption, active && styles.languageOptionActive]}
                onPress={() => void setLanguage(language)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.languageOptionText, active && styles.languageOptionTextActive]}>
                  {t(LANGUAGE_LABEL_KEY[language])}
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
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
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
    color: colors.text,
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
  },
  languageCard: {
    gap: spacing.md,
  },
  languageLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.faint,
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
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  languageOptionTextActive: {
    color: colors.onPrimary,
  },
});
