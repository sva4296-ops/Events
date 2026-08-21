import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export interface AssignableGuestRow {
  id: string;
  name: string;
  /** Non-null when this guest already sits at a *different* table — shown
   * disabled/grayed with this as the note, rather than left out of the list
   * entirely, so it's clear why they can't be picked here. */
  disabledReason: string | null;
}

interface TableGuestPickerModalProps {
  visible: boolean;
  onClose: () => void;
  guests: AssignableGuestRow[];
  selected: Set<string>;
  onToggle: (guestId: string) => void;
  seatCap: number;
}

/**
 * Multi-select bottom sheet for "Assign guests" on app/table/[id].tsx —
 * same Modal + backdrop + sheet + checkbox-FlatList shape as
 * components/ContactPickerModal.tsx (the app's one existing multi-select
 * pattern), reused rather than inventing a second one. Unlike that modal,
 * selection is controlled by the caller (not owned internally) so the
 * "X / Y seats assigned" counter can stay visible on the composer screen
 * itself, not just inside the sheet.
 */
export function TableGuestPickerModal({
  visible,
  onClose,
  guests,
  selected,
  onToggle,
  seatCap,
}: TableGuestPickerModalProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const capReached = seatCap > 0 && selected.size >= seatCap;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          style={[styles.sheet, { backgroundColor: tokens.surfaceElevated }]}
          activeOpacity={1}
          onPress={() => undefined}
        >
          <Text style={[styles.title, { color: tokens.textPrimary }]}>
            {t('tableForm.assignGuestsLabel')}
          </Text>
          <Text style={[styles.counter, { color: tokens.textSecondary }]}>
            {t('tableForm.seatsAssignedCount', { assigned: selected.size, total: seatCap })}
          </Text>
          {capReached ? (
            <Text style={[styles.capNotice, { color: tokens.accentPrimary }]}>
              {t('tableForm.seatsCapReached')}
            </Text>
          ) : null}

          {guests.length === 0 ? (
            <Text style={[styles.message, { color: tokens.textSecondary }]}>
              {t('tableForm.noConfirmedGuests')}
            </Text>
          ) : (
            <FlatList
              data={guests}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = selected.has(item.id);
                const disabled = item.disabledReason !== null || (!isSelected && capReached);
                return (
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => onToggle(item.id)}
                    disabled={disabled}
                    activeOpacity={disabled ? 1 : 0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected, disabled }}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? tokens.accentPrimary : tokens.surfaceBorder ?? 'rgba(0,0,0,0.2)',
                          backgroundColor: isSelected ? tokens.accentPrimary : 'transparent',
                          opacity: disabled && !isSelected ? 0.4 : 1,
                        },
                      ]}
                    >
                      {isSelected ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                    </View>
                    <View style={styles.rowText}>
                      <Text
                        style={[
                          styles.rowName,
                          { color: tokens.textPrimary, opacity: disabled && !isSelected ? 0.5 : 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      {item.disabledReason !== null ? (
                        <Text style={[styles.rowNote, { color: tokens.textSecondary }]} numberOfLines={1}>
                          {item.disabledReason}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <Button label={t('common.done')} onPress={onClose} style={styles.confirm} />
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
    borderTopLeftRadius: themeRadius.lg,
    borderTopRightRadius: themeRadius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    maxHeight: '80%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  counter: {
    fontSize: 13,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  capNotice: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.lg,
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
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
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
  confirm: {
    marginTop: spacing.md,
  },
});
