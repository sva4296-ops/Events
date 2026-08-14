import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';

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
import { useTheme } from '@/hooks/useTheme';
import { countRsvps } from '@/utils/format';
import { fonts, gSpace } from '@/utils/guestTheme';
import { themeRadius } from '@/utils/themeTokens';
import { WEB_CONTENT_WIDTH } from '@/utils/webLayout';

export default function AlbumScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, deletePhoto } = useEventContent(id);

  const owner = isOwner(event);

  const loading = content === null;
  const photos = content?.photos ?? [];
  const attendees = event === undefined ? 0 : countRsvps(event.guests).confirmed;

  const statCard = [
    styles.stat,
    {
      backgroundColor: tokens.surfaceElevated,
      borderColor: tokens.surfaceBorder ?? 'transparent',
      borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
    },
    tokens.surfaceElevatedShadow ?? undefined,
  ];

  return (
    <GuestScreen transparent webMaxWidth={WEB_CONTENT_WIDTH.wide}>
      <View style={styles.intro}>
        <SectionLabel>{t('album.sectionLabel')}</SectionLabel>
        <Text style={[styles.headline, { color: tokens.textPrimary }]}>{t('album.headline')}</Text>
      </View>

      <View style={styles.stats}>
        <View style={statCard}>
          <Text style={[styles.statValue, { color: tokens.accentPrimary }]}>{attendees}</Text>
          <Text style={[styles.statLabel, { color: tokens.textSecondary }]}>
            {t('album.attendeesLabel')}
          </Text>
        </View>
        <View style={statCard}>
          <Text style={[styles.statValue, { color: tokens.accentPrimary }]}>{photos.length}</Text>
          <Text style={[styles.statLabel, { color: tokens.textSecondary }]}>{t('album.photosLabel')}</Text>
        </View>
      </View>

      <View style={styles.albumBlock}>
        <Text style={[styles.albumTitle, { color: tokens.textPrimary }]}>{t('album.albumTitle')}</Text>
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
          <EmptyState message={t('album.empty')} />
        ) : (
          <View style={styles.grid}>
            {photos.map((photo) => (
              <PhotoTile
                key={photo.id}
                photo={photo}
                style={[styles.tile, { backgroundColor: tokens.surface }]}
                canDelete={owner || photo.uploaded_by === user?.id}
                onDelete={deletePhoto}
              />
            ))}
          </View>
        )}
      </View>

      <View style={Platform.OS === 'web' ? styles.actionsWeb : styles.actionsNative}>
        <GuestButton label={t('album.downloadAll')} onPress={() => {}} />
        <GuestButton label={t('album.backToStart')} variant="outline" onPress={() => router.push('/')} />
      </View>
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
  },
  stats: {
    flexDirection: 'row',
    gap: gSpace.md,
  },
  stat: {
    flex: 1,
    borderRadius: themeRadius.lg,
    paddingVertical: gSpace.xl,
    alignItems: 'center',
    gap: gSpace.xs,
  },
  statValue: {
    fontFamily: fonts.displayBold,
    fontSize: 30,
  },
  statLabel: {
    fontSize: 12,
  },
  albumBlock: {
    gap: gSpace.md,
  },
  albumTitle: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gSpace.sm,
  },
  tile: {
    // Wider web column (see webMaxWidth above) fits more per row than the
    // mobile 3-across — same %-of-container approach, just a smaller share.
    width: Platform.OS === 'web' ? '15%' : '31%',
    flexGrow: 1,
    aspectRatio: 1,
    borderRadius: themeRadius.md,
  },
  // Native: the two buttons used to be direct children of GuestScreen's own
  // gapped column; wrapping them in one View to lay them out differently on
  // web means reproducing that inter-button gap locally instead.
  actionsNative: {
    gap: gSpace.lg,
  },
  actionsWeb: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: gSpace.md,
  },
});
