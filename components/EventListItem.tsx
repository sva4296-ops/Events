import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PlanTierBadge } from '@/components/PlanTierBadge';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { AppEvent } from '@/types/event';
import { getEventType } from '@/utils/eventTypes';
import { countRsvps, eventSubtitle } from '@/utils/format';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

/**
 * Warm Story accent block: the event-type emoji is kept (it reads clearly at
 * a glance and carries real information — which of the 7 event types this
 * is), but its background is now the fixed gold→pink "flourish" gradient
 * instead of each type's own gradient, per the spec's literal accent-block
 * color, layered with the emoji as the "small icon" on top. Row layout (badge
 * left, info right, chevron) is kept rather than switching to a stacked
 * block-above-name card — better list scanability at this density, and the
 * badge already served as the row's visual anchor before this pass.
 */
export function EventListItem({
  event,
  onPress,
  planLabel,
  onPressChoosePlan,
}: {
  event: AppEvent;
  onPress: () => void;
  /** Resolved plan_features.display_name for event.planTier, or null when
   * planTier itself is null (no plan chosen yet) — see app/index.tsx, the
   * only caller, for how this is looked up. */
  planLabel: string | null;
  onPressChoosePlan: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const type = getEventType(event.type);
  const counts = countRsvps(event.guests);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${event.name}, ${counts.confirmed} confirmed`}
      style={[
        styles.row,
        {
          backgroundColor: tokens.surfaceElevated,
          borderColor: tokens.surfaceBorder ?? 'transparent',
          borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
        },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <LinearGradient colors={[tokens.accentGold, tokens.accentPink]} style={styles.badge}>
        <Text style={styles.emoji}>{type.emoji}</Text>
      </LinearGradient>

      <View style={styles.info}>
        <Text style={[styles.name, { color: tokens.textPrimary }]} numberOfLines={1}>
          {event.name}
        </Text>
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]} numberOfLines={1}>
          {eventSubtitle(event)}
        </Text>
        <Text style={[styles.counts, { color: tokens.textSecondary }]}>
          {t('common.eventRsvpSummary', { confirmed: counts.confirmed, pending: counts.pending })}
        </Text>
      </View>

      <Feather name="chevron-right" size={18} color={tokens.textSecondary} />

      <PlanTierBadge planLabel={planLabel} onPressChoose={onPressChoosePlan} />
    </TouchableOpacity>
  );
}

/** Same row/badge/info dimensions as the real row above, so nothing shifts when data lands. */
export function EventListItemSkeleton() {
  return (
    <View style={styles.row}>
      <Skeleton width={30} height={30} radius={9} />
      <View style={styles.info}>
        <Skeleton height={15} width="70%" radius={4} />
        <Skeleton height={12} width="50%" radius={4} />
        <Skeleton height={11} width="35%" radius={4} />
      </View>
      <Skeleton width={18} height={18} radius={9} />
      <Skeleton height={20} width={72} radius={themeRadius.pill} style={styles.planBadgeSkeleton} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: themeRadius.lg,
    // The plan-tier ribbon is absolutely positioned half outside the card's
    // top-right corner (see PlanTierBadge) — without this, the card's own
    // rounded-corner clipping would cut the overhanging half off.
    overflow: 'visible',
  },
  badge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 15,
  },
  info: {
    flex: 1,
    gap: 1,
  },
  // Matches PlanTierBadge's own absolute top/right offsets exactly, so the
  // skeleton occupies the same corner the real ribbon renders in once data
  // lands.
  planBadgeSkeleton: {
    position: 'absolute',
    top: -10,
    right: -10,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  counts: {
    fontSize: 11,
  },
});
