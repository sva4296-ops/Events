import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EventTypeIcon } from '@/components/EventTypeIcon';
import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { EventTypeId } from '@/types/event';
import type { Moment, ReactionType } from '@/types/guest';
import { timeAgo } from '@/utils/relativeTime';
import { brandGradient, themeRadius, typography } from '@/utils/themeTokens';

interface MomentCardProps {
  moment: Moment;
  /** Who posted it — moments are organizer posts, so this is the event's name. */
  authorName: string;
  /** Event type, drawn as a line icon in the gradient avatar. */
  authorType: EventTypeId | null;
  loveCount: number;
  celebrateCount: number;
  lovedByMe: boolean;
  celebratedByMe: boolean;
  onReact: (reaction: ReactionType) => void;
}

/** Warm Story 2.0 moment post: author row with a "Moment" chip, Playfair title, photo, reactions. */
export function MomentCard({
  moment,
  authorName,
  authorType,
  loveCount,
  celebrateCount,
  lovedByMe,
  celebratedByMe,
  onReact,
}: MomentCardProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        tokens.surfaceElevatedShadow ?? undefined,
      ]}
    >
      <View style={styles.author}>
        <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.avatar}>
          <EventTypeIcon type={authorType} size={18} color="#2B2740" />
        </LinearGradient>
        <View style={styles.authorText}>
          <Text style={[styles.authorName, { color: tokens.textPrimary }]} numberOfLines={1}>
            {authorName}
          </Text>
          <Text style={[styles.time, { color: tokens.textSecondary }]}>{timeAgo(moment.created_at)}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: tokens.accentTint }]}>
          <Text style={[styles.chipText, { color: tokens.accentText }]}>{t('acasa.momentChip')}</Text>
        </View>
      </View>

      <Text style={[styles.title, { color: tokens.textPrimary }]}>{moment.title}</Text>

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
    </View>
  );
}

/** Same author/title/photo/reaction-row dimensions as the real card above. */
export function MomentCardSkeleton() {
  const { tokens } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      <View style={styles.author}>
        <Skeleton width={36} height={36} radius={18} />
        <View style={styles.authorText}>
          <Skeleton height={13} width="45%" radius={4} />
          <Skeleton height={11} width="25%" radius={4} />
        </View>
      </View>
      <Skeleton height={20} width="60%" radius={4} />
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
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  chip: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: themeRadius.pill,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontFamily: typography.title2.fontFamily,
    fontSize: 20,
    lineHeight: 25,
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
