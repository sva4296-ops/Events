import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { Field } from '@/components/Field';
import { Header } from '@/components/Header';
import { MapPickerModal, type PickedLocation } from '@/components/MapPickerModal';
import { Screen } from '@/components/Screen';
import { VenueMapPreview } from '@/components/VenueMapPreview';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { mapsAvailable } from '@/utils/maps';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export default function VenueScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isVenueManager } = useEvents();
  const event = getEvent(id);
  const { content, updateVenue } = useEventContent(id ?? '');
  const { tokens } = useTheme();

  const [name, setName] = useState(content?.venue.name ?? '');
  const [address, setAddress] = useState(content?.venue.address ?? '');
  const [notes, setNotes] = useState((content?.venue.notes ?? []).join('\n'));
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    content !== null && content.venue.latitude !== null && content.venue.longitude !== null
      ? { latitude: content.venue.latitude, longitude: content.venue.longitude }
      : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!isVenueManager(event) || content === null) {
    return (
      <Screen coverType={event?.type}>
        <Header
          title={t('common.notAvailable')}
          subtitle={t('venueForm.notAvailableSubtitle')}
          showBack
        />
      </Screen>
    );
  }

  const save = () => {
    updateVenue({
      event_id: id ?? '',
      name,
      address,
      notes: notes
        .split('\n')
        .map((note) => note.trim())
        .filter((note) => note.length > 0),
      map_image_url: content.venue.map_image_url,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    });
    router.back();
  };

  const onPick = (picked: PickedLocation) => {
    setCoords({ latitude: picked.latitude, longitude: picked.longitude });
    if (picked.address !== null) setAddress(picked.address);
    setPickerOpen(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Screen
        coverType={event?.type}
        footer={<Button label={t('venueForm.saveButton')} disabled={name.trim().length === 0} onPress={save} />}
      >
        <Header
          title={content.venue.name.trim().length === 0 ? t('venueForm.setTitle') : t('venueForm.editTitle')}
          subtitle={t('common.guestsSeeOnDetalii')}
          showBack
        />

        <Field label={t('venueForm.nameLabel')} value={name} onChangeText={setName} />
        <Field label={t('venueForm.addressLabel')} value={address} onChangeText={setAddress} />

        {mapsAvailable ? (
          <View style={styles.mapSection}>
            <Text style={[styles.mapLabel, { color: tokens.textSecondary }]}>{t('venueForm.mapLabel')}</Text>
            {coords !== null ? (
              <View
                style={[
                  styles.mapCard,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <VenueMapPreview latitude={coords.latitude} longitude={coords.longitude} height={150} />
                <View style={[styles.mapActions, { borderTopColor: tokens.border }]}>
                  <TouchableOpacity
                    style={styles.mapAction}
                    onPress={() => setPickerOpen(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Feather name="edit-2" size={16} color={tokens.accentText} />
                    <Text style={[styles.mapActionText, { color: tokens.accentText }]}>
                      {t('venueForm.changeOnMap')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.mapAction}
                    onPress={() => setCoords(null)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                  >
                    <Feather name="x" size={16} color={tokens.textSecondary} />
                    <Text style={[styles.mapActionText, { color: tokens.textSecondary }]}>
                      {t('venueForm.removeFromMap')}
                    </Text>
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
            <Text style={[styles.mapHint, { color: tokens.textMuted }]}>{t('venueForm.mapHint')}</Text>
          </View>
        ) : null}

        <Field
          label={t('venueForm.notesLabel')}
          value={notes}
          onChangeText={setNotes}
          hint={t('venueForm.notesHint')}
          multiline
        />
      </Screen>

      {pickerOpen && mapsAvailable ? (
        <MapPickerModal initial={coords} onClose={() => setPickerOpen(false)} onPick={onPick} />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  mapSection: {
    gap: spacing.sm,
  },
  mapLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  mapCard: {
    borderRadius: themeRadius.lg,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  mapActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  mapAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  mapActionText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  mapHint: {
    fontSize: 12,
  },
});
