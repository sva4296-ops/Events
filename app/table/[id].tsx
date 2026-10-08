import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { TableGuestPickerModal, type AssignableGuestRow } from '@/components/TableGuestPickerModal';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import type { TableShape } from '@/types/guest';
import { haptics } from '@/utils/haptics';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export default function SeatingTableScreen() {
  const { t } = useTranslation();
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId?: string }>();
  const { getEvent, isVenueManager, isRestaurant } = useEvents();
  const { tokens } = useTheme();
  const event = getEvent(id);
  const { content, saveSeatingTable } = useEventContent(id ?? '');

  const existing = content?.seatingTables.find((table) => table.id === itemId) ?? null;

  const [name, setName] = useState(existing?.name ?? '');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [seatCount, setSeatCount] = useState(existing === null ? '' : String(existing.seat_count));
  const [shape, setShape] = useState<TableShape>(existing?.shape ?? 'round');
  // Pre-check whoever's already assigned to this table (edit mode); empty for a new one.
  const [selectedGuestIds, setSelectedGuestIds] = useState<Set<string>>(
    () =>
      new Set(
        (event?.guests ?? [])
          .filter((guest) => existing !== null && guest.tableId === existing.id)
          .map((guest) => guest.id),
      ),
  );
  const [pickerVisible, setPickerVisible] = useState(false);

  if (!isVenueManager(event) || content === null || event === undefined) {
    return (
      <Screen>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('tableForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const seatCap = Number.parseInt(seatCount, 10);
  const hasSeatCap = Number.isFinite(seatCap) && seatCap > 0;
  // The restaurant builds the table; the couple seats people. So the
  // restaurant sees who's seated (read-only) and can't go below that count.
  const restaurant = isRestaurant(event);
  const seatedHere = selectedGuestIds.size;
  const tooFewSeats = restaurant && hasSeatCap && seatCap < seatedHere;

  // Only a confirmed guest can be seated; anyone already on a *different*
  // table shows disabled with a note instead of being left out silently.
  const tableNameById = new Map(content.seatingTables.map((table) => [table.id, table.name]));
  const assignableGuests: AssignableGuestRow[] = event.guests
    .filter((guest) => guest.status === 'confirmed')
    .map((guest) => ({
      id: guest.id,
      name: guest.name,
      disabledReason:
        guest.tableId !== null && guest.tableId !== existing?.id
          ? t('tableForm.guestAlreadyAssigned', { table: tableNameById.get(guest.tableId) ?? '' })
          : null,
    }));

  const toggleGuest = (guestId: string) => {
    setSelectedGuestIds((current) => {
      const next = new Set(current);
      if (next.has(guestId)) {
        next.delete(guestId);
      } else {
        // Cap enforcement lives here too, not just in the modal's disabled
        // state — a defensive no-op if something ever calls toggle past cap.
        if (hasSeatCap && next.size >= seatCap) return current;
        next.add(guestId);
      }
      return next;
    });
  };

  const selectedNames = assignableGuests
    .filter((guest) => selectedGuestIds.has(guest.id))
    .map((guest) => guest.name);

  // Shrinking Seats below the current assignment count would otherwise leave
  // the table over-assigned relative to its own cap until the picker is
  // reopened — trim the newest selections down to fit as soon as it happens.
  const handleSeatCountChange = (value: string) => {
    setSeatCount(value);
    if (restaurant) return;
    const parsed = Number.parseInt(value, 10);
    const cap = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    if (cap > 0 && cap < selectedGuestIds.size) {
      setSelectedGuestIds((current) => new Set(Array.from(current).slice(0, cap)));
    }
  };

  const save = () => {
    const parsed = Number.parseInt(seatCount, 10);
    saveSeatingTable({
      id: existing?.id ?? null,
      name: name.trim(),
      label,
      seat_count: Number.isFinite(parsed) ? parsed : 0,
      shape,
      guestIds: restaurant ? null : Array.from(selectedGuestIds),
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        coverType={event?.type}
        footer={
          <Button
            label={existing === null ? t('tableForm.addButton') : t('common.saveChanges')}
            disabled={name.trim().length === 0 || tooFewSeats}
            onPress={save}
          />
        }
      >
        <Header
          title={existing === null ? t('tableForm.addTitle') : t('tableForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
        />

        <Field
          label={t('tableForm.nameLabel')}
          value={name}
          onChangeText={setName}
          placeholder={t('tableForm.namePlaceholder')}
        />
        <Field
          label={t('tableForm.labelLabel')}
          value={label}
          onChangeText={setLabel}
          placeholder={t('tableForm.labelPlaceholder')}
        />
        <Field
          label={t('tableForm.seatsLabel')}
          value={seatCount}
          onChangeText={handleSeatCountChange}
          placeholder={t('tableForm.seatsPlaceholder')}
          keyboardType="numeric"
        />

        <View style={styles.assignSection}>
          <Text style={[styles.assignLabel, { color: tokens.textPrimary }]}>{t('tableForm.shapeLabel')}</Text>
          <View style={[styles.segment, { backgroundColor: tokens.surface2 }]} accessibilityRole="tablist">
            {(['round', 'rect'] as const).map((option) => {
              const active = option === shape;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.segmentItem, active ? [styles.segmentActive, { backgroundColor: tokens.surface }] : null]}
                  onPress={() => {
                    haptics.tap();
                    setShape(option);
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <View
                    style={[
                      option === 'round' ? styles.shapeIconRound : styles.shapeIconRect,
                      { borderColor: active ? tokens.textPrimary : tokens.textSecondary },
                    ]}
                  />
                  <Text style={[styles.segmentText, { color: active ? tokens.textPrimary : tokens.textSecondary }]}>
                    {option === 'round' ? t('tableForm.shapeRound') : t('tableForm.shapeRect')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.assignSection}>
          <Text style={[styles.assignLabel, { color: tokens.textPrimary }]}>
            {restaurant ? t('tableForm.seatedGuestsLabel') : t('tableForm.assignGuestsLabel')}
          </Text>
          <TouchableOpacity
            style={[
              styles.assignRow,
              {
                backgroundColor: tokens.surface,
                borderColor: tokens.border,
                opacity: hasSeatCap ? 1 : 0.6,
              },
            ]}
            onPress={() => setPickerVisible(true)}
            disabled={!hasSeatCap || restaurant}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('tableForm.assignGuestsLabel')}
          >
            <Text
              style={[
                styles.assignRowText,
                { color: selectedNames.length > 0 ? tokens.textPrimary : tokens.textSecondary },
              ]}
              numberOfLines={2}
            >
              {selectedNames.length > 0 ? selectedNames.join(', ') : t('tableForm.assignGuestsPlaceholder')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: tooFewSeats ? tokens.statusDeclined : tokens.textSecondary }]}>
            {tooFewSeats
              ? t('tableForm.restaurantTooFewSeats', { count: seatedHere })
              : restaurant
                ? t('tableForm.restaurantSeatingHint')
                : hasSeatCap
                  ? t('tableForm.seatsAssignedCount', { assigned: selectedGuestIds.size, total: seatCap })
                  : t('tableForm.seatsRequiredHint')}
          </Text>
        </View>
      </Screen>

      <TableGuestPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        guests={assignableGuests}
        selected={selectedGuestIds}
        onToggle={toggleGuest}
        seatCap={hasSeatCap ? seatCap : 0}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  assignSection: {
    gap: spacing.sm,
  },
  assignLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  assignRow: {
    borderRadius: themeRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
    justifyContent: 'center',
  },
  assignRowText: {
    fontSize: 15,
  },
  hint: {
    fontSize: 12,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
  },
  segmentItem: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  segmentActive: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  shapeIconRound: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  shapeIconRect: {
    width: 20,
    height: 11,
    borderRadius: 3,
    borderWidth: 1.5,
  },
});
