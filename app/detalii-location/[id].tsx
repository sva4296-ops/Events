import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { Button, buttonLabelColor } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { LongPressRow } from '@/components/LongPressRow';
import { Screen } from '@/components/Screen';
import { VenueMapPreview } from '@/components/VenueMapPreview';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gRadius, gSpace } from '@/utils/guestTheme';
import { confirmDelete } from '@/utils/confirm';
import { mapsAvailable, openInMaps, openInWaze } from '@/utils/maps';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surface,
    borderColor: tokens.border,
    borderWidth: 1,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

export default function DetaliiLocationScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isVenueManager } = useEvents();
  const event = getEvent(id);
  const owner = isVenueManager(event);
  const { content, deleteVenue } = useEventContent(id ?? '');
  const { tokens } = useTheme();

  if (content === null) {
    return (
      <Screen>
        <Header title={t('detalii.hub.locationTitle')} showBack />
      </Screen>
    );
  }

  const hasVenue = content.venue.name.trim().length > 0 || content.venue.address.trim().length > 0;
  const card = cardStyle(tokens);

  return (
    <GuestScreen topInset>
      <Header title={t('detalii.hub.locationTitle')} showBack />

      {!hasVenue ? (
        <EmptyState
          message={owner ? t('detalii.venueEmptyOwner') : t('detalii.venueEmptyGuest')}
          action={
            owner ? <GuestButton label={t('detalii.setVenue')} onPress={() => router.push(`/venue/${id}`)} /> : undefined
          }
        />
      ) : (
        // Hold the card to edit or delete the location, like every other list.
        <LongPressRow
          title={content.venue.name.trim() || content.venue.address}
          enabled={owner}
          actions={[
            { label: t('common.edit'), tone: 'edit', onPress: () => router.push(`/venue/${id}`) },
            {
              label: t('common.delete'),
              tone: 'delete',
              onPress: () =>
                confirmDelete(
                  t('detalii.deleteVenueTitle'),
                  t('detalii.deleteVenueBody', { name: content.venue.name.trim() || content.venue.address }),
                  deleteVenue,
                ),
            },
          ]}
        >
        <View style={[styles.mapCard, card]}>
          {mapsAvailable && content.venue.latitude !== null && content.venue.longitude !== null ? (
            <VenueMapPreview latitude={content.venue.latitude} longitude={content.venue.longitude} height={170} />
          ) : (
            <View style={[styles.mapPreview, { backgroundColor: tokens.surface2 }]}>
              <Image source={{ uri: content.venue.map_image_url }} style={styles.map} />
              <View style={[styles.pin, { backgroundColor: tokens.surface, borderColor: tokens.border, borderWidth: 1 }]}>
                <Feather name="map-pin" size={20} color={tokens.accentText} />
              </View>
            </View>
          )}

          <View style={styles.venueBody}>
            <Text style={[styles.venueName, { color: tokens.textPrimary }]}>{content.venue.name}</Text>
            <Text style={[styles.venueAddress, { color: tokens.textSecondary }]}>
              {content.venue.address}
            </Text>
            <View style={styles.notes}>
              {content.venue.notes.map((note) => (
                <View key={note} style={styles.noteRow}>
                  <View style={[styles.dot, { backgroundColor: tokens.accentGold }]} />
                  <Text style={[styles.noteText, { color: tokens.textSecondary }]}>{note}</Text>
                </View>
              ))}
            </View>
            <View style={styles.navRow}>
              <Button
                label={t('detalii.openInMaps')}
                onPress={() => openInMaps(content.venue)}
                icon={<Feather name="navigation" size={18} color={buttonLabelColor('primary', tokens)} />}
                style={styles.navPrimary}
              />
              <Button label={t('detalii.openInWaze')} variant="secondary" onPress={() => openInWaze(content.venue)} />
            </View>
          </View>
        </View>
        </LongPressRow>
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    borderRadius: themeRadius.xl,
    overflow: 'hidden',
  },
  mapPreview: {
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pin: {
    width: 44,
    height: 44,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueBody: {
    padding: gSpace.xl,
    gap: gSpace.xs,
  },
  venueName: {
    fontFamily: fonts.displayBold,
    fontSize: 20,
  },
  venueAddress: {
    fontSize: 14,
  },
  notes: {
    marginTop: gSpace.md,
    gap: gSpace.sm,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: gSpace.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: gRadius.pill,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  navRow: {
    flexDirection: 'row',
    gap: gSpace.sm,
    marginTop: gSpace.lg,
  },
  navPrimary: {
    flex: 1,
  },
});
