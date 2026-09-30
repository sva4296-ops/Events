import type { EventTypeId, EventTypeMeta, Gradient } from '@/types/event';

export const EVENT_TYPES: readonly EventTypeMeta[] = [
  {
    id: 'wedding',
    label: 'Wedding',
    emoji: '💍',
    gradient: ['#F7C8D8', '#C9B6F2'],
    band: ['#F5C36B', '#E8779E', '#7F77DD'],
    accent: '#B4568C',
  },
  {
    id: 'baptism',
    label: 'Baptism',
    emoji: '🍼',
    gradient: ['#CFE7FF', '#E4D6FF'],
    band: ['#C4E6F6', '#A9B8F2', '#C7A8EE'],
    accent: '#3F7BC4',
  },
  {
    id: 'birthday',
    label: 'Birthday',
    emoji: '🎂',
    gradient: ['#FFD8B0', '#FFB9CE'],
    band: ['#FFD98A', '#F5A36B', '#E8779E'],
    accent: '#D2703C',
  },
  {
    id: 'cause',
    label: 'Cause',
    emoji: '💚',
    gradient: ['#BFEFD3', '#CFE9FF'],
    band: ['#C4EBCF', '#6CC49A', '#2E9E6B'],
    accent: '#2E9E6B',
  },
  {
    id: 'corporate',
    label: 'Corporate',
    emoji: '🏢',
    gradient: ['#D3DDF0', '#C3CFE8'],
    band: ['#9AADE0', '#5B6BB8', '#3A4180'],
    accent: '#41567F',
  },
  {
    id: 'memorial',
    label: 'Memorial',
    emoji: '🕊️',
    gradient: ['#E2E4EC', '#D7DDF0'],
    band: ['#D6D2DC', '#A29DAD', '#6E6880'],
    accent: '#5B6076',
  },
  {
    id: 'other',
    label: 'Other',
    // Not ➕ — a plus inside a tile or avatar reads as an "add" button.
    emoji: '✨',
    gradient: ['#E8DDFB', '#D6E4FF'],
    band: ['#F5C36B', '#E8779E', '#7F77DD'],
    accent: '#6C4CE0',
  },
];

const FALLBACK: EventTypeMeta = EVENT_TYPES[EVENT_TYPES.length - 1] as EventTypeMeta;

export function getEventType(id: EventTypeId | null): EventTypeMeta {
  return EVENT_TYPES.find((type) => type.id === id) ?? FALLBACK;
}

/**
 * Light/dark gradient pair per event type, for theme-aware surfaces (the
 * invite preview header). Deliberately separate from EVENT_TYPES' own
 * `gradient` field above, which stays light-mode-only and keeps driving
 * every other consumer (TypeTile, EventListItem, InvitationListItem,
 * InviteCard's icon strip) unchanged.
 *
 * Single centralized lookup, keyed by event_type — adding a new event type
 * only ever needs a new entry here, never a change to whatever reads it via
 * getEventTypeGradient. Dark variants follow the same "warm navy-purple,
 * not pure black" direction as utils/themeTokens.ts's darkTheme, just
 * carried into each type's own hue family instead of one flat dark wash.
 */
interface EventTypeGradientPair {
  light: Gradient;
  dark: Gradient;
}

const EVENT_TYPE_GRADIENTS: Record<EventTypeId, EventTypeGradientPair> = {
  wedding: { light: ['#F7C8D8', '#C9B6F2'], dark: ['#4A2A44', '#2E2350'] },
  baptism: { light: ['#CFE7FF', '#E4D6FF'], dark: ['#1F3350', '#2A2B52'] },
  birthday: { light: ['#FFD8B0', '#FFB9CE'], dark: ['#4A2E22', '#4A2440'] },
  cause: { light: ['#BFEFD3', '#CFE9FF'], dark: ['#1E3B2E', '#1E2F45'] },
  corporate: { light: ['#D3DDF0', '#C3CFE8'], dark: ['#232B42', '#1C2238'] },
  memorial: { light: ['#E2E4EC', '#D7DDF0'], dark: ['#2C2E3D', '#272B42'] },
  other: { light: ['#E8DDFB', '#D6E4FF'], dark: ['#2E2350', '#20263F'] },
};

const FALLBACK_GRADIENT_PAIR: EventTypeGradientPair = EVENT_TYPE_GRADIENTS.other;

/**
 * Looks up the light/dark gradient pair for an event type and returns the
 * variant for the given theme mode. Falls back to the 'other' pair — same
 * fallback event type getEventType() already uses — for a null id or an
 * event_type value not yet present in EVENT_TYPE_GRADIENTS (e.g. a new
 * Postgres enum value added before its gradient entry), rather than
 * crashing or rendering nothing.
 */
export function getEventTypeGradient(id: EventTypeId | null, mode: 'light' | 'dark'): Gradient {
  const pair = (id !== null ? EVENT_TYPE_GRADIENTS[id] : undefined) ?? FALLBACK_GRADIENT_PAIR;
  return pair[mode];
}
