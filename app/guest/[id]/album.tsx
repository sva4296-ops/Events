import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { PhotoTile } from '@/components/guest/PhotoTile';
import { ProgressBar } from '@/components/guest/ProgressBar';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import { GUEST_PHOTO_LIMIT } from '@/utils/limits';
import { themeRadius, typography } from '@/utils/themeTokens';

type AlbumFilter = 'all' | 'mine';

export default function AlbumScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, addPhoto, deletePhoto } = useEventContent(id);
  const [filter, setFilter] = useState<AlbumFilter>('all');

  const owner = isOwner(event);
  const loading = content === null;
  const photos = content?.photos ?? [];
  const uploaders = new Set(photos.map((photo) => photo.uploaded_by)).size;
  const visible = filter === 'mine' ? photos.filter((photo) => photo.uploaded_by === user?.id) : photos;
  const canDownload = event?.albumStatus === 'ready' && photos.length > 0;
  const myCount = photos.filter((photo) => photo.uploaded_by === user?.id).length;
  // Organizers have no limit; the server enforces it too (guest photo limit trigger).
  const limitReached = !owner && myCount >= GUEST_PHOTO_LIMIT;

  // Moved here from the Live tab (Live is video only now).
  const pickPhoto = async () => {
    if (limitReached) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || asset === undefined) return;

    addPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const filters: { key: AlbumFilter; label: string }[] = [
    { key: 'all', label: t('album.filterAll') },
    { key: 'mine', label: t('album.filterMine') },
  ];

  return (
    <GuestScreen transparent>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('album.title')}</Text>
          <TouchableOpacity
            onPress={() => Alert.alert(t('album.infoTitle'), t('album.infoBody', { limit: GUEST_PHOTO_LIMIT }))}
            activeOpacity={0.7}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('album.infoTitle')}
          >
            <Feather name="info" size={20} color={tokens.textSecondary} />
          </TouchableOpacity>
        </View>
        {!loading ? (
          <Text style={[styles.summary, { color: tokens.textSecondary }]}>
            {t('album.summary', { count: photos.length, people: uploaders })}
          </Text>
        ) : null}
      </View>

      <View style={[styles.uploadCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <View style={styles.uploadHead}>
          <View style={[styles.uploadIcon, { backgroundColor: tokens.accentTint }]}>
            <Feather name="camera" size={20} color={tokens.accentText} />
          </View>
          <View style={styles.uploadCopy}>
            <Text style={[styles.uploadTitle, { color: tokens.textPrimary }]}>{t('album.yourPhotos')}</Text>
            <Text style={[styles.uploadCaption, { color: tokens.textSecondary }]}>
              {owner
                ? t('album.noLimitOrganizer')
                : t('album.uploadedOf', { count: myCount, limit: GUEST_PHOTO_LIMIT })}
            </Text>
          </View>
        </View>
        {!owner ? <ProgressBar current={myCount} target={GUEST_PHOTO_LIMIT} /> : null}
        <Button
          label={limitReached ? t('album.limitReached') : t('album.upload')}
          icon={
            limitReached ? undefined : (
              <Feather name="upload" size={20} color={buttonLabelColor('primary', tokens)} />
            )
          }
          disabled={limitReached}
          onPress={() => void pickPhoto()}
        />
      </View>

      <View style={[styles.filters, { backgroundColor: tokens.surface2 }]} accessibilityRole="tablist">
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.chip, active && { backgroundColor: tokens.surface }]}
            >
              <Text style={[styles.chipText, { color: active ? tokens.textPrimary : tokens.textSecondary }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.grid}>
          {Array.from({ length: 9 }, (_, index) => (
            <Skeleton key={index} style={styles.tile} radius={0} />
          ))}
        </View>
      ) : visible.length === 0 ? (
        <EmptyState message={filter === 'mine' ? t('album.emptyMine') : t('album.empty')} />
      ) : (
        <View style={styles.grid}>
          {visible.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              style={[styles.tile, { backgroundColor: tokens.surface2 }]}
              canDelete={owner || photo.uploaded_by === user?.id}
              onDelete={deletePhoto}
              labelFontSize={10}
            />
          ))}
        </View>
      )}

      {/* Download only once the server cron marks the album ready (events.album_status,
          ~72h after the event). The timing is explained in the ⓘ next to the title. */}
      {canDownload ? (
        <TouchableOpacity
          style={[styles.download, { backgroundColor: tokens.textPrimary }]}
          onPress={() => {}}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Feather name="download" size={20} color={tokens.surface} />
          <Text style={[styles.downloadText, { color: tokens.surface }]}>{t('album.downloadAll')}</Text>
        </TouchableOpacity>
      ) : null}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    ...typography.title2,
    fontSize: 26,
    lineHeight: 31,
  },
  summary: {
    fontSize: 13,
  },
  uploadCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  uploadHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uploadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadCopy: {
    flex: 1,
    gap: 2,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  uploadCaption: {
    fontSize: 13,
  },
  filters: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: themeRadius.pill,
  },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: themeRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderRadius: 18,
    overflow: 'hidden',
  },
  tile: {
    width: '32.4%',
    aspectRatio: 1,
    borderRadius: 0,
  },
  download: {
    minHeight: 54,
    borderRadius: themeRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 22,
  },
  downloadText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
