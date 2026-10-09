import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { MapPickerModal, type PickedLocation } from '@/components/MapPickerModal';
import { VenueMapPreview } from '@/components/VenueMapPreview';
import { useTheme } from '@/hooks/useTheme';
import { mapsAvailable } from '@/utils/maps';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

interface MapPointFieldProps {
  value: MapPoint | null;
  /** The pin the organizer picked, with its reverse-geocoded address (may be null). */
  onPick: (picked: PickedLocation) => void;
  onClear: () => void;
}

/**
 * "Punct pe hartă" form field: a button that opens the map picker, or the
 * picked point's preview with Change / Remove. Shared by the venue editor and
 * the schedule item editor. Renders nothing where maps aren't available
 * (Android without a Google Maps key).
 */
export function MapPointField({ value, onPick, onClear }: MapPointFieldProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!mapsAvailable) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: tokens.textSecondary }]}>{t('venueForm.mapLabel')}</Text>
      {value !== null ? (
        <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
          <VenueMapPreview latitude={value.latitude} longitude={value.longitude} height={150} />
          <View style={[styles.actions, { borderTopColor: tokens.border }]}>
            <TouchableOpacity
              style={styles.action}
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Feather name="edit-2" size={16} color={tokens.accentText} />
              <Text style={[styles.actionText, { color: tokens.accentText }]}>{t('venueForm.changeOnMap')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={onClear} activeOpacity={0.7} accessibilityRole="button">
              <Feather name="x" size={16} color={tokens.textSecondary} />
              <Text style={[styles.actionText, { color: tokens.textSecondary }]}>{t('venueForm.removeFromMap')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Button
          label={t('venueForm.pickOnMap')}
          variant="secondary"
          onPress={() => setPickerOpen(true)}
          icon={<Feather name="map" size={18} color={buttonLabelColor('secondary', tokens)} />}
        />
      )}
      <Text style={[styles.hint, { color: tokens.textMuted }]}>{t('venueForm.mapHint')}</Text>

      {pickerOpen ? (
        <MapPickerModal
          initial={value}
          onClose={() => setPickerOpen(false)}
          onPick={(picked) => {
            setPickerOpen(false);
            onPick(picked);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: themeRadius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  hint: {
    fontSize: 12,
  },
});
