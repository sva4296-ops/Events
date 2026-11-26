import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';

import { PhotoViewer } from '@/components/PhotoViewer';

import type { Photo } from '@/types/guest';
import { confirmDelete } from '@/utils/confirm';

interface PhotoTileProps {
  photo: Photo;
  style: StyleProp<ViewStyle>;
  canDelete: boolean;
  onDelete: (photoId: string) => void | Promise<unknown>;
  /** Live's filmstrip tiles are much smaller than Album's — shrink the caption to match. */
  labelFontSize?: number;
  /** Open a shared gallery instead of this tile's own single-photo viewer. */
  onOpen?: () => void;
}

/**
 * Grid tiles are too small for a horizontal swipe, so deletion is long-press
 * here rather than the swipe actions used on full-width rows. Tapping opens a
 * full-screen viewer — always available, unlike delete, which stays gated on
 * canDelete via onLongPress alone rather than disabling the whole tile.
 */
export function PhotoTile({ photo, style, canDelete, onDelete, labelFontSize = 12, onOpen }: PhotoTileProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const label = photo.uploaded_by_label ?? 'Invitat';
  // Grid tile: thumbnail (400px). Lightbox: display (2048px, ~3x a phone
  // screen), or full for older photos that have no display version. The
  // 2800px full is otherwise only for "download all". `url` is the legacy
  // local-device URI from before real Storage uploads existed.
  const gridUri = photo.thumb_url ?? photo.url ?? undefined;
  const viewerUri = photo.display_url ?? photo.full_url ?? photo.url ?? undefined;
  const viewerKey = photo.display_url !== null ? 'display' : 'full';

  return (
    <>
      <TouchableOpacity
        style={[styles.tile, style]}
        activeOpacity={0.85}
        onPress={() => (onOpen !== undefined ? onOpen() : setViewerOpen(true))}
        onLongPress={
          canDelete
            ? () =>
                confirmDelete('Ștergi poza?', 'Poza va dispărea din Live și din album.', () =>
                  onDelete(photo.id),
                )
            : undefined
        }
        accessibilityRole="button"
        accessibilityLabel={`Poză de la ${label}`}
      >
        {/* Signed URLs change hourly: a stable key keeps thumbnails on disk, so they aren't downloaded again. */}
        <Image
          source={{ uri: gridUri, cacheKey: `photo-${photo.id}-thumb` }}
          cachePolicy="disk"
          recyclingKey={photo.id}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.scrim}>
          <Text style={[styles.label, { fontSize: labelFontSize }]} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <PhotoViewer
        uri={viewerUri}
        cacheKey={`photo-${photo.id}-${viewerKey}`}
        placeholderUri={gridUri}
        placeholderCacheKey={`photo-${photo.id}-thumb`}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
        caption={label}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tile: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  scrim: {
    paddingHorizontal: 8,
    paddingTop: 18,
    paddingBottom: 6,
  },
  label: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
