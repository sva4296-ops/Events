import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import { useTheme } from '@/hooks/useTheme';
import type { Moment, ReactionType } from '@/types/guest';
import { gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';
import { timeAgo } from '@/utils/relativeTime';

interface MomentCardProps {
  moment: Moment;
  loveCount: number;
  celebrateCount: number;
  lovedByMe: boolean;
  celebratedByMe: boolean;
  onReact: (reaction: ReactionType) => void;
  onComments: () => void;
}

export function MomentCard({
  moment,
  loveCount,
  celebrateCount,
  lovedByMe,
  celebratedByMe,
  onReact,
  onComments,
}: MomentCardProps) {
  const { t } = useTranslation();
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
      <View style={styles.head}>
        <Text style={[styles.time, { color: tokens.textSecondary }]}>{timeAgo(moment.created_at)}</Text>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{moment.title}</Text>
      </View>

      {moment.photo_url.length > 0 ? (
        <Image source={{ uri: moment.photo_url }} style={[styles.photo, { backgroundColor: tokens.surface }]} />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder, { backgroundColor: tokens.surfaceMuted }]}>
          <Feather name="image" size={28} color={tokens.textSecondary} />
          <Text style={[styles.photoPlaceholderLabel, { color: tokens.textSecondary }]}>
            {t('acasa.noPhoto')}
          </Text>
        </View>
      )}

      <View style={styles.reactions}>
        <ReactionPill
          icon="heart"
          color={tokens.accentPrimary}
          background={`${tokens.accentPrimary}22`}
          count={loveCount}
          active={lovedByMe}
          label="Reacționează cu inimă"
          onPress={() => onReact('love')}
        />
        <ReactionPill
          icon="star"
          color={tokens.accentGold}
          background={`${tokens.accentGold}33`}
          count={celebrateCount}
          active={celebratedByMe}
          label="Reacționează cu felicitări"
          onPress={() => onReact('celebrate')}
        />

        <TouchableOpacity
          style={styles.comments}
          onPress={onComments}
          activeOpacity={0.7}
          accessibilityRole="link"
        >
          <Feather name="message-circle" size={14} color={tokens.textSecondary} />
          <Text style={[styles.commentsText, { color: tokens.textSecondary }]}>{t('acasa.comments')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Same head/photo/reaction-row dimensions as the real card above. */
export function MomentCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Skeleton height={12} width="30%" radius={4} />
        <Skeleton height={18} width="60%" radius={4} />
      </View>

      <Skeleton height={230} radius={0} />

      <View style={styles.reactions}>
        <Skeleton width={54} height={30} radius={themeRadius.pill} />
        <Skeleton width={54} height={30} radius={themeRadius.pill} />
      </View>
    </View>
  );
}

function ReactionPill({
  icon,
  color,
  background,
  count,
  active,
  label,
  onPress,
}: {
  icon: 'heart' | 'star';
  color: string;
  background: string;
  count: number;
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: background }, active && { borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Feather name={icon} size={13} color={color} />
      <Text style={[styles.pillCount, { color }]}>{count}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeRadius.lg,
    overflow: 'hidden',
  },
  head: {
    paddingHorizontal: gSpace.xl,
    paddingTop: gSpace.xl,
    paddingBottom: gSpace.md,
    gap: gSpace.xs,
  },
  time: {
    fontSize: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  photo: {
    width: '100%',
    height: 230,
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: gSpace.xs,
  },
  photoPlaceholderLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.sm,
    padding: gSpace.lg,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.sm,
    paddingHorizontal: gSpace.md,
    paddingVertical: gSpace.sm,
    borderRadius: themeRadius.pill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillCount: {
    fontSize: 13,
    fontWeight: '700',
  },
  comments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.xs,
    marginLeft: 'auto',
    paddingHorizontal: gSpace.sm,
  },
  commentsText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
