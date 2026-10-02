/* eslint-disable @typescript-eslint/no-require-imports -- Metro bundles images only through static require(). */
import type { ImageSourcePropType } from 'react-native';

import type { EventTypeId } from '@/types/event';

/**
 * Default cover photo per event type, shown on Home's event cards and as the
 * invitation thumbnail. Replace a file in assets/event-covers/ with a real
 * photo (same name, landscape, ~1200x675 JPG) and it shows up everywhere.
 */
export const EVENT_COVERS: Record<EventTypeId, ImageSourcePropType> = {
  wedding: require('../assets/event-covers/wedding.jpg'),
  baptism: require('../assets/event-covers/baptism.jpg'),
  birthday: require('../assets/event-covers/birthday.jpg'),
  cause: require('../assets/event-covers/cause.jpg'),
  corporate: require('../assets/event-covers/corporate.jpg'),
  memorial: require('../assets/event-covers/memorial.jpg'),
  other: require('../assets/event-covers/other.jpg'),
};
