import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import type { OutingKind, SpontaneousTemplate } from '@/types/event';

type FeatherName = ComponentProps<typeof Feather>['name'];

/**
 * The spontaneous wizard's two choices: the kind of outing (step "Ce fel de
 * ieșire?") and the activity ("Ce faceți?"). An activity decides the Plan
 * tab's tool (events.template), the suggested cover theme and the title.
 * Labels live in locales under spontaneous.outings.<kind> and
 * spontaneous.activities.<id>.
 */
export interface Activity {
  id: string;
  icon: FeatherName;
  /** Tool profile written to events.template. */
  template: SpontaneousTemplate;
  /** utils/coverThemes.ts id. */
  coverTheme: string;
}

export interface Outing {
  id: OutingKind;
  icon: FeatherName;
  /** Tool profile when the activity step is skipped or "Altceva" is picked. */
  template: SpontaneousTemplate;
  coverTheme: string;
  activities: readonly Activity[];
}

export const OUTINGS: readonly Outing[] = [
  {
    id: 'party',
    icon: 'gift',
    template: 'party',
    coverTheme: 'petrecere',
    activities: [
      { id: 'home', icon: 'home', template: 'party', coverTheme: 'petrecere' },
      { id: 'grill', icon: 'sun', template: 'party', coverTheme: 'petrecere' },
      { id: 'birthday', icon: 'gift', template: 'party', coverTheme: 'petrecere' },
      { id: 'movie', icon: 'film', template: 'party', coverTheme: 'neon' },
      { id: 'games', icon: 'grid', template: 'party', coverTheme: 'petrecere' },
    ],
  },
  {
    id: 'outing',
    icon: 'map-pin',
    template: 'outing',
    coverTheme: 'neon',
    activities: [
      { id: 'karaoke', icon: 'mic', template: 'karaoke', coverTheme: 'karaoke' },
      { id: 'bowling', icon: 'disc', template: 'outing', coverTheme: 'neon' },
      { id: 'dinner', icon: 'coffee', template: 'outing', coverTheme: 'degustare' },
      { id: 'bar', icon: 'droplet', template: 'outing', coverTheme: 'neon' },
      { id: 'escape', icon: 'lock', template: 'outing', coverTheme: 'neon' },
      { id: 'billiards', icon: 'target', template: 'outing', coverTheme: 'neon' },
    ],
  },
  {
    id: 'limited',
    icon: 'tag',
    template: 'limited',
    coverTheme: 'degustare',
    activities: [
      { id: 'wine', icon: 'droplet', template: 'tasting', coverTheme: 'degustare' },
      { id: 'concert', icon: 'music', template: 'limited', coverTheme: 'karaoke' },
      { id: 'workshop', icon: 'edit-3', template: 'limited', coverTheme: 'petrecere' },
      { id: 'match', icon: 'activity', template: 'limited', coverTheme: 'neon' },
      { id: 'theatre', icon: 'smile', template: 'limited', coverTheme: 'degustare' },
    ],
  },
  {
    id: 'trip',
    icon: 'briefcase',
    template: 'trip',
    coverTheme: 'aurora',
    activities: [
      { id: 'mountain', icon: 'triangle', template: 'trip', coverTheme: 'aurora' },
      { id: 'sea', icon: 'anchor', template: 'trip', coverTheme: 'aurora' },
      { id: 'citybreak', icon: 'map', template: 'trip', coverTheme: 'neon' },
      { id: 'camping', icon: 'compass', template: 'trip', coverTheme: 'aurora' },
    ],
  },
];

export function getOuting(id: OutingKind | null): Outing {
  return OUTINGS.find((outing) => outing.id === id) ?? OUTINGS[0]!;
}
