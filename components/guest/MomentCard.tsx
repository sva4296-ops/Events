import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { MomentIcon, isMomentIconId } from '@/components/MomentIcon';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Moment, ReactionType } from '@/types/guest';
import { timeAgo } from '@/utils/relativeTime';
import { themeRadius, typeface } from '@/utils/themeTokens';

interface MomentCardProps {
  moment: Moment;
  loveCount: number;
  celebrateCount: number;
  lovedByMe: boolean;
  celebratedByMe: boolean;
  onReact: (reaction: ReactionType) => void;
  /** Organizer only: long press opens edit / delete. */
  onLongPress?: () => void;
}

/** Warm Story 2.0 moment post: author row with a "Moment" chip, Playfair title, photo, reactions. */
export function MomentCard({
  moment,
  loveCount,
  celebrateCount,
  lovedByMe,
  celebratedByMe,
  onReact,
  onLongPress,
}: MomentCardProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <TouchableOpacity
      onLongPress={onLongPress}
      disabled={onLongPress === undefined}
      delayLongPress={350}
      activeOpacity={0.9}
      accessibilityHint={onLongPress !== undefined ? t('acasa.momentLongPressHint') : undefined}
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      {/* The event's own name and a "Moment" chip were redundant inside the
          event: the post opens with its icon, title and when it was posted. */}
      <View style={styles.head}>
        {isMomentIconId(moment.icon) ? (
          <View style={[styles.iconBadge, { backgroundColor: tokens.accentTint }]}>
            <MomentIcon icon={moment.icon} size={20} color={tokens.accentText} />
          </View>
        ) : null}
        <View style={styles.headText}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{moment.title}</Text>
          <Text style={[styles.time, { color: tokens.textSecondary }]} numberOfLines={1}>
            {moment.author_label !== null
              ? t('acasa.postedByAgo', { name: moment.author_label, time: timeAgo(moment.created_at) })
              : timeAgo(moment.created_at)}
          </Text>
        </View>
      </View>

      {moment.photo_url.length > 0 ? (
        <Image source={{ uri: moment.photo_url }} style={[styles.photo, { backgroundColor: tokens.surface2 }]} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: tokens.surface2 }]}>
          <Feather name="image" size={28} color={tokens.textSecondary} />
          <Text style={[styles.photoPlaceholderLabel, { color: tokens.textSecondary }]}>{t('acasa.noPhoto')}</Text>
        </View>
      )}

      <View style={styles.reactions}>
        <ReactionPill
          icon="heart"
          count={loveCount}
          active={lovedByMe}
          label="Reacționează cu inimă"
          onPress={() => onReact('love')}
        />
        <ReactionPill
          icon="star"
          count={celebrateCount}
          active={celebratedByMe}
          label="Reacționează cu felicitări"
          onPress={() => onReact('celebrate')}
        />
        <View style={styles.flex} />
        <Text style={[styles.total, { color: tokens.textSecondary }]}>
          {t('acasa.reactions', { count: loveCount + celebrateCount })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

/** Same author/title/photo/reaction-row dimensions as the real card above. */
export function MomentCardSkeleton() {
  const { tokens } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <View style={styles.head}>
        <Skeleton width={40} height={40} radius={20} />
        <View style={styles.headText}>
          <Skeleton height={16} width="55%" radius={4} />
          <Skeleton height={11} width="25%" radius={4} />
        </View>
      </View>
      <Skeleton height={196} radius={18} />
      <View style={styles.reactions}>
        <Skeleton width={64} height={40} radius={themeRadius.pill} />
        <Skeleton width={64} height={40} radius={themeRadius.pill} />
      </View>
    </View>
  );
}

function ReactionPill({
  icon,
  count,
  active,
  label,
  onPress,
}: {
  icon: 'heart' | 'star';
  count: number;
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  const color = active ? tokens.statusDeclined : tokens.textSecondary;

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: active ? tokens.statusDeclinedSoft : tokens.surface2 }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Feather name={icon} size={18} color={color} />
      <Text style={[styles.pillCount, { color }]}>{count}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: typeface.bodyBold,
    fontSize: 18,
    lineHeight: 24,
  },
  time: {
    fontFamily: typeface.body,
    fontSize: 13,
  },
  photo: {
    width: '100%',
    height: 196,
    borderRadius: 18,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoPlaceholderLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
  },
  pillCount: {
    fontSize: 14,
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
  total: {
    fontSize: 13,
  },
});
