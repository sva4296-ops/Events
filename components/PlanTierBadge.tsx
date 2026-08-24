import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * Ribbon-style badge overlaid on the top-right corner of an event's Home
 * card (components/EventListItem.tsx), roughly half sitting on the card and
 * half hanging outside it — `position: 'absolute'`, negative top/right
 * offsets. The card itself needs `overflow: 'visible'` (set explicitly on
 * EventListItem's `row` style) for the overhanging half to actually render
 * rather than being clipped by the card's own rounded corners.
 *
 * `planLabel` is the resolved plan_features display_name for that tier
 * (looked up by the caller, app/index.tsx) — this component never
 * re-derives it, so the label shown here can't drift from the one on the
 * pricing screen's own card. `planLabel === null` means no plan chosen yet;
 * that state is tappable (navigates to the pricing screen, see
 * EventListItem) and deliberately styled as an outlined chip rather than a
 * solid ribbon, so it reads as an action prompt, not a status label. A
 * chosen plan is a plain, non-interactive, solid accentPrimary ribbon —
 * same purple used for primary buttons (utils/theme.ts's colors.primary /
 * this theme's accentPrimary) — with white text, matching "notification
 * badge" styling elsewhere isn't a precedent this app has, so the shadow
 * values here are a new, smaller-radius shadow suited to a small pill
 * rather than the app's existing large diffuse button/FAB shadow.
 */
export function PlanTierBadge({
  planLabel,
  onPressChoose,
}: {
  planLabel: string | null;
  onPressChoose: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  if (planLabel === null) {
    return (
      <TouchableOpacity
        onPress={onPressChoose}
        activeOpacity={0.75}
        style={[
          styles.badge,
          styles.outlineShadow,
          {
            backgroundColor: tokens.surfaceElevated,
            borderWidth: 1.5,
            borderColor: tokens.statusPending,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('common.choosePlan')}
      >
        <Text style={[styles.text, { color: tokens.statusPending }]}>{t('common.choosePlan')}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[styles.badge, styles.solidShadow, { backgroundColor: tokens.accentPrimary }]}
    >
      <Text style={[styles.text, { color: '#FFFFFF' }]}>{planLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -10,
    right: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: themeRadius.pill,
  },
  solidShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  // Lighter than the solid ribbon's shadow — an outlined chip should read as
  // resting closer to the card, not as prominently "lifted" as a real badge.
  outlineShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
});
