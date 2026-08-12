import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Photo } from '@/types/guest';
import { confirmDelete } from '@/utils/confirm';
import { guest } from '@/utils/guestTheme';

interface PhotoTileProps {
  photo: Photo;
  style: StyleProp<ViewStyle>;
  canDelete: boolean;
  onDelete: (photoId: string) => void;
  /** Live's filmstrip tiles are much smaller than Album's — shrink the caption to match. */
  labelFontSize?: number;
}

/**
 * Grid tiles are too small for a horizontal swipe, so deletion is long-press
 * here rather than the swipe actions used on full-width rows. Tapping opens a
 * full-screen viewer — always available, unlike delete, which stays gated on
 * canDelete via onLongPress alone rather than disabling the whole tile.
 */
export function PhotoTile({ photo, style, canDelete, onDelete, labelFontSize = 12 }: PhotoTileProps) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const label = photo.uploaded_by_label ?? 'Invitat';
  // Grid tile: thumbnail (400px) — this is the whole point of having one.
  // Lightbox: full (2800px, near-lossless) for a crisp zoomed view. `url` is
  // the legacy local-device URI from before real Storage uploads existed —
  // only reached for old rows where a signed URL couldn't be produced.
  const gridUri = photo.thumb_url ?? photo.url ?? undefined;
  const viewerUri = photo.full_url ?? photo.url ?? undefined;

  return (
    <>
      <TouchableOpacity
        style={[styles.tile, style]}
        activeOpacity={0.85}
        onPress={() => setViewerOpen(true)}
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
        <Image source={{ uri: gridUri }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.scrim}>
          <Text style={[styles.label, { fontSize: labelFontSize }]} numberOfLines={1}>
            {label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setViewerOpen(false)}>
          <View style={styles.viewerBackdrop}>
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} resizeMode="contain" />

            <TouchableOpacity
              style={[styles.viewerClose, { top: insets.top + 12 }]}
              onPress={() => setViewerOpen(false)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Închide"
            >
              <Feather name="x" size={22} color={guest.white} />
            </TouchableOpacity>

            <View style={[styles.viewerCaption, { bottom: insets.bottom + 24 }]}>
              <Text style={styles.viewerCaptionText}>{label}</Text>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,8,20,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: '100%',
    height: '80%',
  },
  viewerClose: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCaption: {
    position: 'absolute',
  },
  viewerCaptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
