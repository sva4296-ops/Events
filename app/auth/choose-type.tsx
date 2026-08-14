import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/BackButton';
import { ScreenBackground } from '@/components/ScreenBackground';
import { useTheme } from '@/hooks/useTheme';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * First screen of the sign-up funnel — reached only from /auth's "Sign up"
 * toggle (sign-in → sign-up now routes here first, see app/auth/index.tsx).
 * "Individual" lands back on /auth's own sign-up fields, unchanged; "Agency"
 * goes to its own form since it needs extra business fields. Neither option
 * touches the individual flow itself.
 */
export default function ChooseAccountTypeScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  return (
    <View style={styles.fill}>
      <ScreenBackground />
      <View style={[styles.content, { paddingTop: insets.top + 16 }]}>
        <BackButton />

        <Text style={[styles.headline, { color: tokens.textPrimary }]}>
          {t('accountType.headline')}
        </Text>
        <Text style={[styles.sub, { color: tokens.textSecondary }]}>{t('accountType.subtitle')}</Text>

        <View style={styles.options}>
          <TouchableOpacity
            style={[
              styles.card,
              {
                backgroundColor: tokens.surfaceElevated,
                borderColor: tokens.surfaceBorder ?? 'transparent',
                borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
              },
              tokens.surfaceElevatedShadow ?? undefined,
            ]}
            onPress={() => router.push('/auth?mode=sign-up')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={[styles.icon, { backgroundColor: `${tokens.accentPrimary}22` }]}>
              <Feather name="user" size={22} color={tokens.accentPrimary} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>
                {t('accountType.individualTitle')}
              </Text>
              <Text style={[styles.cardSubtitle, { color: tokens.textSecondary }]}>
                {t('accountType.individualSubtitle')}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={tokens.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.card,
              {
                backgroundColor: tokens.surfaceElevated,
                borderColor: tokens.surfaceBorder ?? 'transparent',
                borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
              },
              tokens.surfaceElevatedShadow ?? undefined,
            ]}
            onPress={() => router.push('/auth/agency-signup')}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <View style={[styles.icon, { backgroundColor: `${tokens.accentGold}33` }]}>
              <Feather name="briefcase" size={22} color={tokens.accentGold} />
            </View>
            <View style={styles.cardText}>
              <Text style={[styles.cardTitle, { color: tokens.textPrimary }]}>
                {t('accountType.agencyTitle')}
              </Text>
              <Text style={[styles.cardSubtitle, { color: tokens.textSecondary }]}>
                {t('accountType.agencySubtitle')}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={tokens.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    gap: spacing.sm,
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 26,
    lineHeight: 34,
    marginTop: spacing.lg,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
  },
  options: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: themeRadius.lg,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
});
