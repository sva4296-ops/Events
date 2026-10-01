import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { useTheme } from '@/hooks/useTheme';
import { PIN_DELTA } from '@/utils/maps';

interface VenueMapPreviewProps {
  latitude: number;
  longitude: number;
  height?: number;
}

/**
 * Static, non-interactive map of a saved venue. `liteMode` makes Android
 * render a bitmap instead of a live map, so it is cheap on low-end phones.
 */
export function VenueMapPreview({ latitude, longitude, height = 160 }: VenueMapPreviewProps) {
  const { tokens } = useTheme();

  return (
    <View style={{ height }} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        liteMode
        region={{ latitude, longitude, latitudeDelta: PIN_DELTA, longitudeDelta: PIN_DELTA }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        userInterfaceStyle={tokens.mode}
      >
        <Marker coordinate={{ latitude, longitude }} pinColor={tokens.accentPrimary} />
      </MapView>
    </View>
  );
}
