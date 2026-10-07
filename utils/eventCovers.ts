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

/**
 * Each type's colors, taken from its cover art (same blobs), for UI that sits
 * next to the cover: the story timeline. `fill` is the solid node color,
 * `onFill` the check drawn on it, `gradient` the progress line and the
 * current-stage dot, `tint` its halo.
 */
export const EVENT_TYPE_COLORS: Record<
  EventTypeId,
  { fill: string; onFill: string; gradient: readonly [string, string, string]; tint: string }
> = {
  wedding: { fill: '#D9668F', onFill: '#FFFFFF', gradient: ['#F5C36B', '#E8779E', '#7F77DD'], tint: 'rgba(232,119,158,0.25)' },
  baptism: { fill: '#8FB8E8', onFill: '#1E1A30', gradient: ['#A9D4F2', '#B9B6F0', '#C7A8EE'], tint: 'rgba(169,212,242,0.3)' },
  birthday: { fill: '#FF8A65', onFill: '#1E1A30', gradient: ['#FFD166', '#FF8A65', '#E8779E'], tint: 'rgba(255,138,101,0.25)' },
  cause: { fill: '#3FB57E', onFill: '#FFFFFF', gradient: ['#C4EBCF', '#6DD3A0', '#2E9E6B'], tint: 'rgba(109,211,160,0.28)' },
  corporate: { fill: '#5B6BB8', onFill: '#FFFFFF', gradient: ['#7CC4FF', '#5B6BB8', '#3A4180'], tint: 'rgba(91,107,184,0.3)' },
  memorial: { fill: '#8F88A6', onFill: '#FFFFFF', gradient: ['#D6D2DC', '#8F88A6', '#4A4560'], tint: 'rgba(143,136,166,0.3)' },
  other: { fill: '#B39DFF', onFill: '#1E1A30', gradient: ['#FF8A65', '#B39DFF', '#7CC4FF'], tint: 'rgba(179,157,255,0.28)' },
};
