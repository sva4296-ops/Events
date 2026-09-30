import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { PhotoTile } from '@/components/guest/PhotoTile';
import { Skeleton } from '@/components/Skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useGuestEvent } from '@/hooks/useGuestEvent';
import { useTheme } from '@/hooks/useTheme';
import { themeRadius, typography } from '@/utils/themeTokens';

type AlbumFilter = 'all' | 'mine';

export default function AlbumScreen() {
  const { t } = useTranslation();
  const { id, event } = useGuestEvent();
  const { user } = useAuth();
  const { isOwner } = useEvents();
  const { tokens } = useTheme();
  const { content, deletePhoto } = useEventContent(id);
  const [filter, setFilter] = useState<AlbumFilter>('all');

  const owner = isOwner(event);
  const loading = content === null;
  const photos = content?.photos ?? [];
  const uploaders = new Set(photos.map((photo) => photo.uploaded_by)).size;
  const visible = filter === 'mine' ? photos.filter((photo) => photo.uploaded_by === user?.id) : photos;
  const canDownload = event?.albumStatus === 'ready' && photos.length > 0;

  const filters: { key: AlbumFilter; label: string }[] = [
    { key: 'all', label: t('album.filterAll') },
    { key: 'mine', label: t('album.filterMine') },
  ];

  return (
    <GuestScreen transparent>
      <View style={styles.head}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('album.title')}</Text>
        {!loading ? (
          <Text style={[styles.summary, { color: tokens.textSecondary }]}>
            {t('album.summary', { count: photos.length, people: uploaders })}
          </Text>
        ) : null}
      </View>

      <View style={styles.filters} accessibilityRole="tablist">
        {filters.map((item) => {
          const active = filter === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setFilter(item.key)}
              activeOpacity={0.8}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: tokens.textPrimary }
                  : { backgroundColor: tokens.surface, borderWidth: 1.5, borderColor: tokens.border },
              ]}
            >
              <Text style={[styles.chipText, { color: active ? tokens.surface : tokens.textPrimary }]}>
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

      {/* The full album only unlocks once the server cron marks it ready
          (~72h after the event date, events.album_status). Before that there's
          nothing final to download, so show when it'll be ready instead. */}
      {event?.albumStatus !== 'ready' ? (
        <Text style={[styles.pendingNote, { color: tokens.textSecondary }]}>{t('album.notReady')}</Text>
      ) : canDownload ? (
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
  title: {
    ...typography.title2,
    fontSize: 26,
    lineHeight: 31,
  },
  summary: {
    fontSize: 13,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: themeRadius.pill,
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
  pendingNote: {
    fontSize: 13,
    textAlign: 'center',
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
