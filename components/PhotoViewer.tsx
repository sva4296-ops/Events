import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { guest } from '@/utils/guestTheme';

interface PhotoViewerProps {
  uri: string | undefined;
  visible: boolean;
  onClose: () => void;
  /** Shown at the bottom, e.g. who took it or the dish name. */
  caption?: string;
}

/**
 * Full-screen photo on a dark backdrop; tap anywhere or the X to close.
 * Shared by the album/live tiles and the menu's course photos.
 */
export function PhotoViewer({ uri, visible, onClose, caption }: PhotoViewerProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />

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

const styles = StyleSheet.create({
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
