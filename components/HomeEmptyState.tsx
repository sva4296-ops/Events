import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { fonts } from '@/utils/guestTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

type FeatherName = keyof typeof Feather.glyphMap;

interface HomeEmptyStateProps {
  icon: FeatherName;
  headline: string;
  message: string;
  ctaLabel?: string;
  onPressCta?: () => void;
}

/**
 * The richer empty-state treatment for Home's two sections only — icon, serif
 * headline, supporting line, optional pill CTA. Deliberately separate from the
 * shared `EmptyState` (used by every other screen's empty states) so this
 * doesn't change their plain message-card look.
 */
export function HomeEmptyState({ icon, headline, message, ctaLabel, onPressCta }: HomeEmptyStateProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: tokens.surfaceBorder ?? 'transparent',
          borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
        },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tokens.accentPrimary}22` }]}>
        <Feather name={icon} size={22} color={tokens.accentPrimary} />
      </View>
      <Text style={[styles.headline, { color: tokens.textPrimary }]}>{headline}</Text>
      <Text style={[styles.message, { color: tokens.textSecondary }]}>{message}</Text>
      {ctaLabel !== undefined && onPressCta !== undefined ? (
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: tokens.accentPrimary }]}
          onPress={onPressCta}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  cta: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  ctaLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
