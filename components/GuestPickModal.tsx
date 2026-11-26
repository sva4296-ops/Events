import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import type { Guest } from '@/types/event';
import { formatPhoneDisplay } from '@/utils/countryCodes';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

interface GuestPickModalProps {
  visible: boolean;
  onClose: () => void;
  /** Already filtered by the caller (only guests with a phone). */
  guests: Guest[];
  onPick: (guest: Guest) => void;
}

/**
 * Single-select bottom sheet: tap one guest and the sheet closes. Same
 * Modal + backdrop + sheet shape as TableGuestPickerModal.
 */
export function GuestPickModal({ visible, onClose, guests, onPick }: GuestPickModalProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  // Edge-to-edge: Android draws modals under the nav bar.
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[
            styles.sheet,
            { backgroundColor: tokens.surface, borderColor: tokens.border, paddingBottom: insets.bottom + spacing.lg },
          ]}
          activeOpacity={1}
          onPress={() => undefined}
        >
          <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('coOrganizers.pickGuestTitle')}</Text>
          <FlatList
            data={guests}
            keyExtractor={(item) => item.id}
            style={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <View style={[styles.avatar, { backgroundColor: tokens.surface2 }]}>
                  <Feather name="user" size={16} color={tokens.textSecondary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: tokens.textPrimary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.phone !== null ? (
                    <Text style={[styles.rowNote, { color: tokens.textSecondary }]} numberOfLines={1}>
                      {formatPhoneDisplay(item.phone)}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={18} color={tokens.textMuted} />
              </TouchableOpacity>
            )}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: themeRadius.sheet,
    borderTopRightRadius: themeRadius.sheet,
    borderWidth: 1,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    maxHeight: '80%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowNote: {
    fontSize: 12,
  },
});
