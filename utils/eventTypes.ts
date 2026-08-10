import type { EventTypeId, EventTypeMeta } from '@/types/event';

export const EVENT_TYPES: readonly EventTypeMeta[] = [
  {
    id: 'wedding',
    label: 'Wedding',
    emoji: '💍',
    gradient: ['#F7C8D8', '#C9B6F2'],
    accent: '#B4568C',
  },
  {
    id: 'baptism',
    label: 'Baptism',
    emoji: '🍼',
    gradient: ['#CFE7FF', '#E4D6FF'],
    accent: '#3F7BC4',
  },
  {
    id: 'birthday',
    label: 'Birthday',
    emoji: '🎂',
    gradient: ['#FFD8B0', '#FFB9CE'],
    accent: '#D2703C',
  },
  {
    id: 'cause',
    label: 'Cause',
    emoji: '💚',
    gradient: ['#BFEFD3', '#CFE9FF'],
    accent: '#2E9E6B',
  },
  {
    id: 'corporate',
    label: 'Corporate',
    emoji: '🏢',
    gradient: ['#D3DDF0', '#C3CFE8'],
    accent: '#41567F',
  },
  {
    id: 'memorial',
    label: 'Memorial',
    emoji: '🕊️',
    gradient: ['#E2E4EC', '#D7DDF0'],
    accent: '#5B6076',
  },
  {
    id: 'other',
    label: 'Other',
    emoji: '➕',
    gradient: ['#E8DDFB', '#D6E4FF'],
    accent: '#6C4CE0',
  },
];

const FALLBACK: EventTypeMeta = EVENT_TYPES[EVENT_TYPES.length - 1] as EventTypeMeta;

export function getEventType(id: EventTypeId | null): EventTypeMeta {
  return EVENT_TYPES.find((type) => type.id === id) ?? FALLBACK;
}
