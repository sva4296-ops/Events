import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { fonts } from '@/utils/guestTheme';
import { colors, radius, shadow, spacing } from '@/utils/theme';

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
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.headline}>{headline}</Text>
      <Text style={styles.message}>{message}</Text>
      {ctaLabel !== undefined && onPressCta !== undefined ? (
        <TouchableOpacity
          style={styles.cta}
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
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  headline: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  cta: {
    marginTop: spacing.md,
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  ctaLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onPrimary,
  },
});
