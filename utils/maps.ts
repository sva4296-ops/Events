import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

/**
 * Whether an in-app map can be shown. iOS uses Apple Maps (no key). Android
 * uses Google Maps, which crashes without an API key, so until
 * GOOGLE_MAPS_ANDROID_API_KEY is set the map picker and previews are hidden
 * there (the Maps/Waze buttons still work).
 */
export const mapsAvailable =
  Platform.OS !== 'android' || Constants.expoConfig?.extra?.hasAndroidMapsKey === true;

export interface MapTarget {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

function hasCoords(target: MapTarget): target is MapTarget & { latitude: number; longitude: number } {
  return target.latitude !== null && target.longitude !== null;
}

/** Free-text fallback for venues saved before coordinates existed. */
function textQuery(target: MapTarget): string {
  return [target.name, target.address].filter((part) => part.trim().length > 0).join(', ');
}

/**
 * Opens the phone's maps app at the venue. Android's `geo:` intent shows the
 * system chooser (Google Maps, Waze, ...); iOS opens Apple Maps.
 */
export function openInMaps(target: MapTarget): void {
  const label = encodeURIComponent(target.name.trim() || target.address.trim());
  let url: string;
  if (hasCoords(target)) {
    const ll = `${target.latitude},${target.longitude}`;
    url = Platform.OS === 'ios' ? `https://maps.apple.com/?ll=${ll}&q=${label}` : `geo:${ll}?q=${ll}(${label})`;
  } else {
    const q = encodeURIComponent(textQuery(target));
    url = Platform.OS === 'ios' ? `https://maps.apple.com/?q=${q}` : `geo:0,0?q=${q}`;
  }
  Linking.openURL(url).catch(() => undefined);
}

/** Opens Waze with navigation started; falls back to the Waze website if the app is missing. */
export function openInWaze(target: MapTarget): void {
  const url = hasCoords(target)
    ? `https://waze.com/ul?ll=${target.latitude},${target.longitude}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(textQuery(target))}&navigate=yes`;
  Linking.openURL(url).catch(() => undefined);
}

/** Romania, zoomed out: the picker's start view when there is no saved pin. */
export const DEFAULT_MAP_REGION = {
  latitude: 45.9432,
  longitude: 24.9668,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

/** Street-level zoom used once a point is known. */
export const PIN_DELTA = 0.005;
