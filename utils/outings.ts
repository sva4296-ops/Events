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
      { id: 'grill', icon: 'sun', template: 'party', coverTheme: 'gradina' },
      { id: 'birthday', icon: 'gift', template: 'party', coverTheme: 'aniversare' },
      { id: 'movie', icon: 'film', template: 'party', coverTheme: 'neon' },
      { id: 'games', icon: 'grid', template: 'party', coverTheme: 'copii' },
    ],
  },
  {
    id: 'outing',
    icon: 'map-pin',
    template: 'outing',
    coverTheme: 'local',
    activities: [
      { id: 'karaoke', icon: 'mic', template: 'karaoke', coverTheme: 'karaoke' },
      { id: 'bowling', icon: 'disc', template: 'outing', coverTheme: 'neon' },
      { id: 'dinner', icon: 'coffee', template: 'outing', coverTheme: 'cina' },
      { id: 'bar', icon: 'droplet', template: 'outing', coverTheme: 'local' },
      { id: 'escape', icon: 'lock', template: 'outing', coverTheme: 'halloween' },
      { id: 'billiards', icon: 'target', template: 'outing', coverTheme: 'elegant' },
    ],
  },
  {
    id: 'limited',
    icon: 'tag',
    template: 'limited',
    coverTheme: 'elegant',
    activities: [
      { id: 'wine', icon: 'droplet', template: 'tasting', coverTheme: 'elegant' },
      { id: 'concert', icon: 'music', template: 'limited', coverTheme: 'disco' },
      { id: 'workshop', icon: 'edit-3', template: 'limited', coverTheme: 'minimal' },
      { id: 'match', icon: 'activity', template: 'limited', coverTheme: 'corporate' },
      { id: 'theatre', icon: 'smile', template: 'limited', coverTheme: 'elegant' },
    ],
  },
  {
    id: 'trip',
    icon: 'briefcase',
    template: 'trip',
    coverTheme: 'aurora',
    activities: [
      { id: 'mountain', icon: 'triangle', template: 'trip', coverTheme: 'aurora' },
      { id: 'sea', icon: 'anchor', template: 'trip', coverTheme: 'plaja' },
      { id: 'citybreak', icon: 'map', template: 'trip', coverTheme: 'local' },
      { id: 'camping', icon: 'compass', template: 'trip', coverTheme: 'gradina' },
    ],
  },
];

export function getOuting(id: OutingKind | null): Outing {
  return OUTINGS.find((outing) => outing.id === id) ?? OUTINGS[0]!;
}
