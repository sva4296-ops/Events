import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Field } from '@/components/Field';
import { MapPickerModal, type PickedLocation } from '@/components/MapPickerModal';
import { useTheme } from '@/hooks/useTheme';
import { mapsAvailable } from '@/utils/maps';
import { spacing } from '@/utils/theme';

export interface MapPoint {
  latitude: number;
  longitude: number;
}

interface LocationFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** The picked map point. Omit for a text-only location (the pin still fills the text). */
  coords?: MapPoint | null;
  /** The pin the organizer picked, with its reverse-geocoded address (may be null). */
  onPick: (picked: PickedLocation) => void;
  /** Removes the map point; only used together with `coords`. */
  onClearCoords?: () => void;
}

/**
 * A location text field with the map pin inside it: tapping the pin opens the
 * map picker. Where the screen stores a map point (`coords`), a small line
 * under the field says a point is set and lets the organizer remove it.
 * Without maps (Android with no Google Maps key) the pin is just decoration.
 */
export function LocationField({
  label,
  value,
  onChangeText,
  placeholder,
  coords,
  onPick,
  onClearCoords,
}: LocationFieldProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);
  const hasPoint = coords !== undefined && coords !== null;

  return (
    <View style={styles.container}>
      <Field
        label={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        icon={
          mapsAvailable ? (
            <TouchableOpacity
              onPress={() => setPickerOpen(true)}
              activeOpacity={0.7}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('createWizard.pickOnMap')}
            >
              <Feather name="map-pin" size={18} color={tokens.accentText} />
            </TouchableOpacity>
          ) : (
            <Feather name="map-pin" size={18} color={tokens.textSecondary} />
          )
        }
      />

      {hasPoint && mapsAvailable ? (
        <View style={styles.pointRow}>
          <Feather name="check-circle" size={14} color={tokens.statusConfirmed} />
          <Text style={[styles.pointText, { color: tokens.textSecondary }]}>{t('locationField.pointSet')}</Text>
          {onClearCoords !== undefined ? (
            <TouchableOpacity onPress={onClearCoords} activeOpacity={0.7} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.pointAction, { color: tokens.accentText }]}>{t('venueForm.removeFromMap')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {pickerOpen ? (
        <MapPickerModal
          initial={hasPoint ? coords : null}
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
  container: {
    gap: spacing.xs,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pointText: {
    fontSize: 13,
    flexShrink: 1,
  },
  pointAction: {
    fontSize: 13,
    fontWeight: '600',
  },
});
