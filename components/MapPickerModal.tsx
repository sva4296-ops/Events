import Feather from '@expo/vector-icons/Feather';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_MAP_REGION, PIN_DELTA } from '@/utils/maps';
import { spacing } from '@/utils/theme';
import { themeRadius } from '@/utils/themeTokens';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  /** Reverse-geocoded street address, null when the lookup found nothing. */
  address: string | null;
}

interface MapPickerModalProps {
  initial: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onPick: (location: PickedLocation) => void;
}

const PIN_SIZE = 44;

function formatAddress(found: Location.LocationGeocodedAddress | undefined): string | null {
  if (found === undefined) return null;
  const street = [found.street, found.streetNumber].filter((part) => part !== null && part.length > 0).join(' ');
  const city = found.city ?? found.subregion ?? found.region;
  const line = [street, city].filter((part) => part !== null && part !== undefined && part.length > 0).join(', ');
  if (line.length > 0) return line;
  return found.formattedAddress ?? found.name ?? null;
}

/**
 * Mount only while open (the parent renders it conditionally), so every
 * opening starts from fresh state.
 *
 * Full-screen map with a fixed center pin: the organizer pans the map under
 * the pin instead of dragging a marker (one view, no marker re-renders).
 * The address under the pin is looked up only when panning stops.
 */
export function MapPickerModal({ initial, onClose, onPick }: MapPickerModalProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const lookupId = useRef(0);
  // Set by a touch on the map or by "my location"; the map's own initial
  // settle on open also fires onRegionChangeComplete and must not count.
  const userMoved = useRef(false);

  const startRegion: Region =
    initial !== null ? { ...initial, latitudeDelta: PIN_DELTA, longitudeDelta: PIN_DELTA } : DEFAULT_MAP_REGION;

  const [center, setCenter] = useState({ latitude: startRegion.latitude, longitude: startRegion.longitude });
  const [address, setAddress] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(initial !== null);
  const [locating, setLocating] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Nothing is picked until the map has been moved onto a spot (or opened on a saved one).
  const [hasPoint, setHasPoint] = useState(initial !== null);

  const lookUp = (latitude: number, longitude: number) => {
    const id = ++lookupId.current;
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then((results) => {
        if (id === lookupId.current) setAddress(formatAddress(results[0]));
      })
      .catch(() => {
        if (id === lookupId.current) setAddress(null);
      })
      .finally(() => {
        if (id === lookupId.current) setLookingUp(false);
      });
  };

  // Opened on a saved pin: show its address right away.
  useEffect(() => {
    if (initial !== null) lookUp(initial.latitude, initial.longitude);
    // Runs once per mount; the parent mounts this only while the picker is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRegionChangeComplete = (region: Region) => {
    if (!userMoved.current) return;
    setCenter({ latitude: region.latitude, longitude: region.longitude });
    setHasPoint(true);
    setLookingUp(true);
    lookUp(region.latitude, region.longitude);
  };

  const goToMyLocation = async () => {
    setNotice(null);
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== Location.PermissionStatus.GRANTED) {
        setNotice(t('mapPicker.permissionDenied'));
        return;
      }
      setLocationGranted(true);
      const position =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const { latitude, longitude } = position.coords;
      userMoved.current = true;
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: PIN_DELTA, longitudeDelta: PIN_DELTA }, 400);
    } catch {
      setNotice(t('mapPicker.permissionDenied'));
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    onPick({ latitude: center.latitude, longitude: center.longitude, address });
  };

  const status = !hasPoint
    ? t('mapPicker.hint')
    : lookingUp
      ? t('mapPicker.lookingUp')
      : (address ?? t('mapPicker.noAddress'));

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={[styles.fill, { backgroundColor: tokens.background[0] }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={startRegion}
          onRegionChangeComplete={onRegionChangeComplete}
          onTouchStart={() => {
            userMoved.current = true;
          }}
          showsUserLocation={locationGranted}
          showsMyLocationButton={false}
          toolbarEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          userInterfaceStyle={tokens.mode}
        />

        {/* Tip of the pin sits exactly on the map center. */}
        <View style={styles.pinLayer} pointerEvents="none">
          <View style={styles.pin}>
            <Feather name="map-pin" size={PIN_SIZE} color={tokens.accentPrimary} />
          </View>
          <View style={[styles.pinShadow, { backgroundColor: tokens.textPrimary }]} />
        </View>

        <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
          <TouchableOpacity
            style={[styles.roundButton, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('mapPicker.close')}
          >
            <Feather name="x" size={20} color={tokens.textPrimary} />
          </TouchableOpacity>
          <View style={[styles.titlePill, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>{t('mapPicker.title')}</Text>
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.myLocation, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            onPress={goToMyLocation}
            disabled={locating}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('mapPicker.myLocation')}
          >
            {locating ? (
              <ActivityIndicator size="small" color={tokens.accentText} />
            ) : (
              <Feather name="navigation" size={18} color={tokens.accentText} />
            )}
            <Text style={[styles.myLocationText, { color: tokens.accentText }]}>{t('mapPicker.myLocation')}</Text>
          </TouchableOpacity>

          <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
            <View style={styles.addressRow}>
              <View style={[styles.addressIcon, { backgroundColor: tokens.accentTint }]}>
                <Feather name="map-pin" size={18} color={tokens.accentText} />
              </View>
              <Text style={[styles.address, { color: tokens.textPrimary }]} numberOfLines={2}>
                {status}
              </Text>
            </View>
            {notice !== null ? <Text style={[styles.notice, { color: tokens.textSecondary }]}>{notice}</Text> : null}
            <Button label={t('mapPicker.confirm')} onPress={confirm} disabled={!hasPoint} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  pinLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pin: {
    transform: [{ translateY: -PIN_SIZE / 2 }],
  },
  pinShadow: {
    position: 'absolute',
    width: 8,
    height: 4,
    borderRadius: 4,
    opacity: 0.25,
  },
  topBar: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  myLocation: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: themeRadius.pill,
    borderWidth: 1,
    paddingVertical: 4,
  },
  myLocationText: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  card: {
    borderRadius: themeRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: themeRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  address: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  notice: {
    fontSize: 13,
  },
});
