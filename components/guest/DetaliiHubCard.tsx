import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';

type FeatherName = keyof typeof Feather.glyphMap;

interface DetaliiHubCardProps {
  icon: FeatherName;
  title: string;
  status: string;
  /** Whether this section has any data set yet. For the organizer an
   * incomplete section shows a "De completat" badge. */
  complete: boolean;
  /** True when this sub-feature isn't included in the event's current plan
   * (see hooks/usePlanGate.tsx) — shows a lock badge. `onPress` is the
   * caller's responsibility to point at the pricing screen when set. */
  locked?: boolean;
  /** False hides the set/not-set badge — it's an organizer checklist signal,
   * meaningless to a guest who only ever sees sections with content. */
  showStatusDot?: boolean;
  onPress: () => void;
}

/**
 * Warm Story 2.0 Detalii tile (two per row): tinted icon, optional badge top
 * right, title and a one-line status. Tapping opens the sub-screen.
 */
export function DetaliiHubCard({
  icon,
  title,
  status,
  complete,
  locked = false,
  showStatusDot = true,
  onPress,
}: DetaliiHubCardProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${status}`}
      style={[styles.tile, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, { backgroundColor: tokens.accentTint }]}>
          <Feather name={icon} size={20} color={tokens.accentText} />
        </View>
        {locked ? (
          <View style={[styles.badge, { backgroundColor: tokens.statusPendingSoft }]}>
            <Feather name="lock" size={11} color={tokens.statusPending} />
            <Text style={[styles.badgeText, { color: tokens.statusPending }]}>{t('detalii.hub.locked')}</Text>
          </View>
        ) : showStatusDot && !complete ? (
          <View style={[styles.badge, { backgroundColor: tokens.statusPendingSoft }]}>
            <Text style={[styles.badgeText, { color: tokens.statusPending }]}>{t('detalii.hub.toComplete')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, { color: tokens.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.status, { color: tokens.textSecondary }]} numberOfLines={2}>
          {status}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Same tile dimensions as the real card, so nothing shifts on load. */
export function DetaliiHubCardSkeleton() {
  const { tokens } = useTheme();

  return (
    <View style={[styles.tile, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <Skeleton width={40} height={40} radius={14} />
      <View style={styles.info}>
        <Skeleton height={15} width="55%" radius={4} />
        <Skeleton height={13} width="75%" radius={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 112,
    padding: 14,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    justifyContent: 'space-between',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 23,
    paddingHorizontal: 8,
    borderRadius: 999,
    flexShrink: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  info: {
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  status: {
    fontSize: 13,
    lineHeight: 18,
  },
});
