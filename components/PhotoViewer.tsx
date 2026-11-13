import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { guest } from '@/utils/guestTheme';

interface PhotoViewerProps {
  uri: string | undefined;
  visible: boolean;
  onClose: () => void;
  /** Shown at the bottom, e.g. who took it or the dish name. */
  caption?: string;
  /** Stable disk-cache key for a signed URL that changes (chat photos). */
  cacheKey?: string;
  /** Already-cached small version, shown at once while `uri` loads. */
  placeholderUri?: string;
  placeholderCacheKey?: string;
}

/**
 * Full-screen photo on a dark backdrop; tap anywhere or the X to close.
 * Shared by the album/live tiles and the menu's course photos.
 */
export function PhotoViewer({ uri, visible, onClose, caption, cacheKey, placeholderUri, placeholderCacheKey }: PhotoViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <Image
            source={{ uri, cacheKey }}
            placeholder={placeholderUri !== undefined ? { uri: placeholderUri, cacheKey: placeholderCacheKey } : undefined}
            placeholderContentFit="contain"
            cachePolicy="disk"
            style={styles.image}
            contentFit="contain"
          />

          <TouchableOpacity
            style={[styles.close, { top: insets.top + 12 }]}
            onPress={onClose}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Feather name="x" size={22} color={guest.white} />
          </TouchableOpacity>

          {caption !== undefined && caption.length > 0 ? (
            <View style={[styles.caption, { bottom: insets.bottom + 24 }]}>
              <Text style={styles.captionText}>{caption}</Text>
            </View>
          ) : null}
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export interface GalleryPhoto {
  id: string;
  uri: string | undefined;
  /** Small version shown while the full one loads. */
  placeholderUri?: string;
  caption?: string;
}

/**
 * The same full-screen viewer over a list: swipe sideways for the next photo,
 * tap or the X to close. Mount only while open, so it starts on `initialIndex`.
 * Only the open photo and its neighbours load.
 */
export function PhotoGallery({
  photos,
  initialIndex,
  onClose,
}: {
  photos: readonly GalleryPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(initialIndex);
  const current = photos[index];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(photo) => photo.id}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
          initialNumToRender={1}
          windowSize={3}
          maxToRenderPerBatch={1}
          onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <TouchableWithoutFeedback onPress={onClose}>
              <View style={[styles.page, { width }]}>
                <Image
                  source={{ uri: item.uri, cacheKey: `gallery-${item.id}-display` }}
                  placeholder={item.placeholderUri !== undefined ? { uri: item.placeholderUri } : undefined}
                  placeholderContentFit="contain"
                  cachePolicy="disk"
                  contentFit="contain"
                  style={styles.image}
                />
              </View>
            </TouchableWithoutFeedback>
          )}
        />

        <TouchableOpacity
          style={[styles.close, { top: insets.top + 12 }]}
          onPress={onClose}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        >
          <Feather name="x" size={22} color={guest.white} />
        </TouchableOpacity>

        <View style={[styles.caption, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          {current?.caption !== undefined && current.caption.length > 0 ? (
            <Text style={styles.captionText}>{current.caption}</Text>
          ) : null}
          {photos.length > 1 ? <Text style={styles.counter}>{`${index + 1} / ${photos.length}`}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,8,20,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  captionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
