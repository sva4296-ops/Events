import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Skeleton } from '@/components/Skeleton';
import type { Moment, ReactionType } from '@/types/guest';
import { guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';
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

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.time}>{timeAgo(moment.created_at)}</Text>
        <Text style={styles.title}>{moment.title}</Text>
      </View>

      <Image source={{ uri: moment.photo_url }} style={styles.photo} />

      <View style={styles.reactions}>
        <ReactionPill
          icon="heart"
          color={guest.purple}
          background={guest.purpleSoft}
          count={loveCount}
          active={lovedByMe}
          label="Reacționează cu inimă"
          onPress={() => onReact('love')}
        />
        <ReactionPill
          icon="star"
          color={guest.gold}
          background={guest.goldSoft}
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
          <Feather name="message-circle" size={14} color={guest.body} />
          <Text style={styles.commentsText}>{t('acasa.comments')}</Text>
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
        <Skeleton width={54} height={30} radius={gRadius.pill} />
        <Skeleton width={54} height={30} radius={gRadius.pill} />
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
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    overflow: 'hidden',
    ...gShadow,
  },
  head: {
    paddingHorizontal: gSpace.xl,
    paddingTop: gSpace.xl,
    paddingBottom: gSpace.md,
    gap: gSpace.xs,
  },
  time: {
    fontSize: 12,
    color: guest.faint,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: guest.ink,
  },
  photo: {
    width: '100%',
    height: 230,
    backgroundColor: guest.creamDeep,
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
    borderRadius: gRadius.pill,
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
    color: guest.body,
  },
});
