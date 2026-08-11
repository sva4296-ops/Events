import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { SectionLabel } from '@/components/guest/SectionLabel';
import { PhotoTile } from '@/components/guest/PhotoTile';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { countRsvps } from '@/utils/format';
import { fonts, guest, gRadius, gShadow, gSpace } from '@/utils/guestTheme';

export default function AlbumScreen() {
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { content, deletePhoto } = useEventContent(id);

  const owner = isOwner(event);

  const loading = content === null;
  const photos = content?.photos ?? [];
  const attendees = event === undefined ? 0 : countRsvps(event.guests).confirmed;

  return (
    <GuestScreen transparent>
      <View style={styles.intro}>
        <SectionLabel>POVESTEA S-A ÎNTÂMPLAT</SectionLabel>
        <Text style={styles.headline}>A fost minunat</Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{attendees}</Text>
          <Text style={styles.statLabel}>invitați prezenți</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{photos.length}</Text>
          <Text style={styles.statLabel}>poze adunate</Text>
        </View>
      </View>

      <View style={styles.albumBlock}>
        <Text style={styles.albumTitle}>Albumul vostru</Text>
        {loading ? (
          <View style={styles.grid}>
            <Skeleton style={styles.tile} />
            <Skeleton style={styles.tile} />
            <Skeleton style={styles.tile} />
            <Skeleton style={styles.tile} />
            <Skeleton style={styles.tile} />
            <Skeleton style={styles.tile} />
          </View>
        ) : photos.length === 0 ? (
          <EmptyState message="Nicio poză încă. Pozele adăugate în Live apar aici." />
        ) : (
          <View style={styles.grid}>
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                style={styles.tile}
                canDelete={owner || photo.uploaded_by === user?.id}
                onDelete={deletePhoto}
              />
            ))}
          </View>
        )}
      </View>

      <GuestButton label="Descarcă toate pozele" onPress={() => {}} />
      <GuestButton label="Înapoi la început" variant="outline" onPress={() => router.push('/')} />
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    alignItems: 'center',
    gap: gSpace.sm,
    paddingTop: gSpace.lg,
  },
  headline: {
    fontFamily: fonts.displayItalic,
    fontSize: 34,
    lineHeight: 44,
    color: guest.ink,
  },
  stats: {
    flexDirection: 'row',
    gap: gSpace.md,
  },
  stat: {
    flex: 1,
    backgroundColor: guest.white,
    borderRadius: gRadius.lg,
    paddingVertical: gSpace.xl,
    alignItems: 'center',
    gap: gSpace.xs,
    ...gShadow,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
    color: guest.purple,
  },
  statLabel: {
    fontSize: 12,
    color: guest.body,
  },
  albumBlock: {
    gap: gSpace.md,
  },
  albumTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
    color: guest.ink,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gSpace.sm,
  },
  tile: {
    width: '31%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: gRadius.md,
    backgroundColor: guest.creamDeep,
  },
});
