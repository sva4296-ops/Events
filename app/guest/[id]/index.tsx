import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { MomentCard } from '@/components/guest/MomentCard';
import { SectionLabel } from '@/components/guest/SectionLabel';
import { SwipeableRow } from '@/components/SwipeableRow';
import { confirmDelete } from '@/utils/confirm';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { fonts, guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';

export default function AcasaScreen() {
  const { id, event } = useGuestEvent();
  const { isOwner } = useEvents();
  const { content, toggleReaction, hasReacted, reactionCount, deleteMoment } =
    useEventContent(id);

  const owner = isOwner(event);

  if (content === null) return <GuestScreen transparent />;

  return (
    <View style={styles.wrap}>
      <GuestScreen contentStyle={owner ? styles.contentWithFab : undefined} transparent>
        <SectionLabel>POVESTEA NOASTRĂ</SectionLabel>

        {content.moments.length === 0 ? (
          <EmptyState
            message={
              owner
                ? 'Niciun moment postat încă. Începe povestea cu o primă poză.'
                : 'Organizatorii nu au postat încă niciun moment.'
            }
          />
        ) : null}

        {content.moments.map((moment) => (
          <SwipeableRow
            key={moment.id}
            enabled={owner}
            actions={[
              {
                label: 'Șterge',
                icon: 'trash-2',
                tone: 'delete',
                onPress: () =>
                  confirmDelete(
                    'Ștergi acest moment?',
                    `„${moment.title}” va dispărea din povestea evenimentului.`,
                    () => deleteMoment(moment.id),
                  ),
              },
            ]}
          >
            <MomentCard
            moment={moment}
            loveCount={reactionCount(moment.id, 'love')}
            celebrateCount={reactionCount(moment.id, 'celebrate')}
            lovedByMe={hasReacted(moment.id, 'love')}
            celebratedByMe={hasReacted(moment.id, 'celebrate')}
            onReact={(reaction) => toggleReaction(moment.id, reaction)}
              onComments={() => router.push(`/guest/${id}/chat`)}
            />
          </SwipeableRow>
        ))}

        {content.fund !== null ? (
          <View style={styles.promo}>
            <Text style={styles.promoTitle}>{content.fund.title}</Text>
            <Text style={styles.promoBody}>
              Ne-ar bucura enorm să faceți parte din următorul capitol al poveștii noastre.
            </Text>
            <GuestButton
              label="Vezi fondul"
              variant="gold"
              onPress={() => router.push(`/guest/${id}/fond`)}
            />
          </View>
        ) : null}
      </GuestScreen>

      {owner ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push(`/post-moment/${id}`)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Postează un moment"
        >
          <Feather name="plus" size={26} color={guest.white} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  contentWithFab: {
    paddingBottom: 92,
  },
  promo: {
    backgroundColor: guest.blush,
    borderRadius: gRadius.lg,
    padding: gSpace.xxl,
    gap: gSpace.md,
    ...gShadow,
  },
  promoTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 22,
    lineHeight: 30,
    color: guest.ink,
  },
  promoBody: {
    fontSize: 14,
    lineHeight: 21,
    color: guest.body,
    marginBottom: gSpace.xs,
  },
  fab: {
    position: 'absolute',
    right: gSpace.xl,
    bottom: gSpace.xl,
    width: 58,
    height: 58,
    borderRadius: gRadius.pill,
    backgroundColor: guest.purple,
    alignItems: 'center',
    justifyContent: 'center',
    ...gShadow,
    shadowOpacity: 0.22,
  },
});
