import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { GuestButton } from '@/components/guest/GuestButton';
import { GuestScreen } from '@/components/guest/GuestScreen';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useEventContent } from '@/hooks/useEventContent';
import { useEvents } from '@/hooks/useEvents';
import { useTheme } from '@/hooks/useTheme';
import { fonts, gRadius, gSpace } from '@/utils/guestTheme';
import { themeRadius, type ThemeTokens } from '@/utils/themeTokens';

function cardStyle(tokens: ThemeTokens) {
  return {
    backgroundColor: tokens.surfaceElevated,
    borderColor: tokens.surfaceBorder ?? 'transparent',
    borderWidth: tokens.surfaceBorder !== null ? 1 : 0,
    ...(tokens.surfaceElevatedShadow ?? {}),
  };
}

export default function DetaliiLocationScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getEvent, isOwner } = useEvents();
  const event = getEvent(id);
  const owner = isOwner(event);
  const { content } = useEventContent(id ?? '');
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
        <View style={[styles.mapCard, card]}>
          {owner ? (
            <TouchableOpacity
              style={[styles.venueEdit, { backgroundColor: tokens.surfaceElevated }]}
              onPress={() => router.push(`/venue/${id}`)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Editează locația"
            >
              <Feather name="edit-2" size={16} color={tokens.accentPrimary} />
            </TouchableOpacity>
          ) : null}
          <View style={[styles.mapPreview, { backgroundColor: tokens.surface }]}>
            <Image source={{ uri: content.venue.map_image_url }} style={styles.map} />
            <View style={[styles.pin, { backgroundColor: tokens.surfaceElevated }]}>
              <Text style={styles.pinText}>📍</Text>
            </View>
          </View>

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
          </View>
        </View>
      )}
    </GuestScreen>
  );
}

const styles = StyleSheet.create({
  mapCard: {
    borderRadius: themeRadius.lg,
    overflow: 'hidden',
  },
  venueEdit: {
    position: 'absolute',
    top: gSpace.md,
    right: gSpace.md,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: gRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
  pinText: {
    fontSize: 20,
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
});
